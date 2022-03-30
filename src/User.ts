import {APIGatewayProxyEvent} from "aws-lambda"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"
import {Application as App} from "./Utils"
import * as AWS from "aws-sdk"
import {Carpool} from "./Carpool"

export namespace User {
    const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})
    export const prefixId: string = "USER"
    export const prefixIdSeparator: string = "#"

    export interface Location {
        longitude: number
        latitude: number
    }

    export function toDynamoDBId(id: string): string {
        return `${prefixId}${prefixIdSeparator}${id}`
    }

    export function fromDynamoDBId(id: string): string {
        return id.split(prefixIdSeparator)[1]
    }

    type Role = "Participant" | "Host"

    export type Carpool = {
        id: string
        isWinner?: boolean
        isHost?: boolean
    }

    async function getCarpoolsRelatedTo(
        userName: string, role: Role, consistent: boolean, status?: Carpool.Status, operator?: string
    ): Promise<User.Carpool[]> {
        const userId: string = User.toDynamoDBId(userName)
        let input: AWS.DynamoDB.Types.QueryInput = {
            TableName: App.Table.name,
            KeyConditionExpression: `${App.Table.Key.Primary.name} = :x`,
            ExpressionAttributeValues: {
                ":x": {[App.Table.Key.Primary.type]: userId}
            },
            Select: "ALL_ATTRIBUTES",
            ConsistentRead: consistent
        }
        let filterExpression: string = ""
        let expressionAttributeNames: AWS.DynamoDB.Types.ExpressionAttributeNameMap | undefined
        let expressionAttributeValues: AWS.DynamoDB.Types.ExpressionAttributeValueMap | undefined =
            input.ExpressionAttributeValues
        if (isDefined(status) && isDefined(operator)) {
            filterExpression = `#s ${operator} :y`
            expressionAttributeNames = {
                "#s": App.Table.Attribute.Carpool.Status.name
            }
            expressionAttributeValues = {
                ...expressionAttributeValues,
                ...{":y": {[App.Table.Attribute.Carpool.Status.type]: status}}
            }
        }
        if (role == "Host") {
            filterExpression = (filterExpression != "")
                ? `${filterExpression} and ${App.Table.Attribute.User.IsHost.name} = :z`
                : `${App.Table.Attribute.User.IsHost.name} = :z`
            expressionAttributeValues = {
                ...expressionAttributeValues,
                ...{":z": {[App.Table.Attribute.User.IsHost.type]: true}}
            }
        }
        if ((isDefined(status) && isDefined(operator)) || role == "Host") {
            input = {
                ...input, ...{
                    FilterExpression: filterExpression,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues
                }
            }
        }
        const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
        if (!isDefined(output.Items)) throw new Error("DynamoDB.query returned undefined")
        const carpools: User.Carpool[] = output.Items.map(item => {
                const isWinner: boolean | undefined = isDefined(item[App.Table.Attribute.User.IsWinner.name]) ?
                    (item[App.Table.Attribute.User.IsWinner.name][App.Table.Attribute.User.IsWinner.type] as boolean)
                    : undefined
                const isHost: boolean | undefined = isDefined(item[App.Table.Attribute.User.IsHost.name]) ?
                    (item[App.Table.Attribute.User.IsHost.name][App.Table.Attribute.User.IsHost.type] as boolean)
                    : undefined
                let carpool: User.Carpool = {
                    id: Carpool.fromDynamoDBId(item[App.Table.Key.Sort.name][App.Table.Key.Sort.type] as string)
                }
                if (isDefined(isWinner)) carpool = {...carpool, ...{winner: isWinner}}
                if (isDefined(isWinner)) carpool = {...carpool, ...{host: isHost}}
                return carpool
            }
        )
        return carpools
    }

    async function getCarpoolsHostedBy(
        userName: string, status: Carpool.Status, operator: string, consistent: boolean
    ): Promise<User.Carpool[]> {
        return await getCarpoolsRelatedTo(userName, "Host", consistent, status, operator)
    }

    export async function getNonClosedCarpoolsHostedBy(userName: string, consistent: boolean): Promise<User.Carpool[]> {
        return await getCarpoolsHostedBy(userName, App.Table.Attribute.Carpool.Status.Closed, "<>", consistent)
    }

    export async function getCarpoolsParticipatedBy(
        userName: string, consistent: boolean, status?: Carpool.Status, operator?: string
    ): Promise<User.Carpool[]> {
        return await getCarpoolsRelatedTo(userName, "Participant", consistent, status, operator)
    }

    export async function getNonClosedCarpoolsParticipatedBy(userName: string, consistent: boolean): Promise<User.Carpool[]> {
        return await
            getCarpoolsParticipatedBy(userName, consistent, App.Table.Attribute.Carpool.Status.Closed, "<>")
    }

    export async function isHostingNonClosedCarpool(userName: string, consistent: boolean): Promise<boolean> {
        const carpools: User.Carpool[] = await User.getNonClosedCarpoolsHostedBy(userName, consistent)
        return carpools.length != 0
    }

    export async function isParticipantNonClosedCarpool(userName: string, consistent: boolean): Promise<boolean> {
        const carpools: User.Carpool[] = await User.getNonClosedCarpoolsParticipatedBy(userName, consistent)
        return carpools.length != 0
    }

    export namespace Create {

        async function save(user: User): Promise<User> {
            console.log(`Saving user=${JSON.stringify(user)} into DynamoDB...`)
            const dynamoDBId: string = User.toDynamoDBId(user.name)
            const input: AWS.DynamoDB.Types.PutItemInput = {
                TableName: App.Table.name,
                Item: {
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId},
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId},
                    [App.Table.Attribute.User.Longitude.name]:
                        {[App.Table.Attribute.User.Longitude.type]: user.longitude.toString()},
                    [App.Table.Attribute.User.Latitude.name]:
                        {[App.Table.Attribute.User.Latitude.type]: user.latitude.toString()},
                }
            }
            await ddb.putItem(input).promise()
            console.log(`User saved into DynamoDB!`)
            return user
        }

        export const endpoint: Endpoint = new Endpoint(
            "/user",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                if (!isDefined(event.body)) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: "body not defined"})
                    }
                } else {
                    let user: User = JSON.parse(event.body)
                    //Save the user to datastore
                    try {
                        user = await save(user)
                        response = {
                            statusCode: 200,
                            body: JSON.stringify(user)
                        }
                    } catch (err: any) {
                        response = {
                            statusCode: 400,
                            body: JSON.stringify({error: err.message})
                        }
                    }
                }
                return response
            })
    }

    export namespace Get {

        async function retrieve(userId: string): Promise<User> {
            const dynamoDBId: string = User.toDynamoDBId(userId)
            const input: AWS.DynamoDB.Types.GetItemInput = {
                TableName: App.Table.name,
                Key: {
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId},
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId}
                }
            }
            const output: AWS.DynamoDB.Types.GetItemOutput = await ddb.getItem(input).promise()
            if (!isDefined(output.Item)) throw new Error("DynamoDB.getItem returned undefined")
            const user: User = {
                name: fromDynamoDBId(output.Item[App.Table.Key.Primary.name][App.Table.Key.Primary.type] as string),
                longitude:
                    +(output.Item[App.Table.Attribute.User.Longitude.name][App.Table.Attribute.User.Longitude.type] as string),
                latitude:
                    +(output.Item[App.Table.Attribute.User.Latitude.name][App.Table.Attribute.User.Latitude.type] as string)
            }
            return user
        }

        export const endpoint: Endpoint = new Endpoint(
            "/user/{id}",
            "GET",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"])) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: "id not defined"})
                    }
                } else {
                    const id: string = event.pathParameters["id"]
                    //Retrieve user from the datastore
                    try {
                        const user: User = await retrieve(id)
                        response = {
                            statusCode: 200,
                            body: JSON.stringify(user)
                        }
                    } catch (err: any) {
                        response = {
                            statusCode: 400,
                            body: JSON.stringify({error: err.message})
                        }
                    }
                }
                return response
            })
    }

    export namespace Update {

        async function update(userId: string, location: User.Location): Promise<User.Location> {
            console.log(`Updating user=${JSON.stringify(userId)}'s location to ${JSON.stringify(location)} into DynamoDB...`)
            const dynamoDBId: string = User.toDynamoDBId(userId)
            const input: AWS.DynamoDB.Types.UpdateItemInput = {
                TableName: App.Table.name,
                Key: {
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId},
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId}
                },
                ConditionExpression: `${App.Table.Key.Primary.name} = :id`,
                UpdateExpression:
                    `set ${App.Table.Attribute.User.Longitude.name} = :x, ${App.Table.Attribute.User.Latitude.name} = :y`,
                ExpressionAttributeValues: {
                    ":x": {[App.Table.Attribute.User.Longitude.type]: location.longitude.toString()},
                    ":y": {[App.Table.Attribute.User.Latitude.type]: location.latitude.toString()},
                    ":id": {[App.Table.Key.Primary.type]: User.toDynamoDBId(userId)}
                }
            }
            await ddb.updateItem(input).promise()
            console.log(`User location updated into DynamoDB!`)
            return location
        }


        export const endpoint: Endpoint = new Endpoint(
            "/user/{id}",
            "PUT",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"])) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: "id not defined"})
                    }
                } else if (!isDefined(event.body)) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: "body not defined"})
                    }
                } else {
                    const id: string = event.pathParameters["id"]
                    let location: User.Location = JSON.parse(event.body)
                    //Update user location into the datastore
                    try {
                        location = await update(id, location)
                        response = {
                            statusCode: 200,
                            body: JSON.stringify(location)
                        }
                    } catch (err: any) {
                        response = {
                            statusCode: 400,
                            body: JSON.stringify({error: err.message})
                        }
                    }
                }
                return response
            })
    }
}

export interface User extends User.Location {
    name: string
}
