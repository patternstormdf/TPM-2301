import {APIGatewayProxyEvent} from "aws-lambda"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"
import {Application as App} from "./Utils"
import * as AWS from "aws-sdk"
import {Carpool} from "./Carpool"
import {DynamoDB} from "@pstorm/aws-cdk";

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
    }

    async function getCarpoolsRelatedTo(userName: string, role: Role, status?: Carpool.Status, operator?: string): Promise<User.Carpool[]> {
        const indexName: string = (role == "Participant")? App.Table.GSI.ParticipantCarpool.name : App.Table.GSI.HostCarpool.name
        const userId: string = (role == "Participant")? User.toDynamoDBId(userName) : userName
        const pkName: string = (role == "Participant")?
            App.Table.GSI.ParticipantCarpool.Key.Primary.name : App.Table.GSI.HostCarpool.Key.Primary.name
        const pkType: DynamoDB.Table.Attribute.Type = (role == "Participant")?
                App.Table.GSI.ParticipantCarpool.Key.Primary.type : App.Table.GSI.HostCarpool.Key.Primary.type
        const skName: string = (role == "Participant")?
            App.Table.GSI.ParticipantCarpool.Key.Sort.name : App.Table.GSI.HostCarpool.Key.Sort.name
        const skType: DynamoDB.Table.Attribute.Type = (role == "Participant")?
            App.Table.GSI.ParticipantCarpool.Key.Sort.type : App.Table.GSI.HostCarpool.Key.Sort.type
        let input: AWS.DynamoDB.Types.QueryInput = {
            TableName: App.Table.name,
            IndexName: indexName,
            KeyConditionExpression: `${pkName} = :x`,
            ExpressionAttributeValues: {
                ":x": {[pkType]: userId}
            },
            Select: "ALL_PROJECTED_ATTRIBUTES"
        }
        if (isDefined(status) && isDefined(operator))
            input = {...input, ...{
                    FilterExpression: `#s ${operator} :y`,
                    ExpressionAttributeNames: {
                        "#s": App.Table.Attribute.Carpool.Status.name
                    },
                    ExpressionAttributeValues: {
                        ...input.ExpressionAttributeValues,
                        ...{":y": {[App.Table.Attribute.Carpool.Status.type]: status}}
                    }
                }}
        const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
        if (!isDefined(output.Items)) throw new Error("DynamoDB.query returned undefined")
        const carpools: User.Carpool[] = output.Items.map(item => {
            const isWinner: boolean | undefined = isDefined(item[App.Table.Attribute.User.IsWinner.name])?
                (item[App.Table.Attribute.User.IsWinner.name][App.Table.Attribute.User.IsWinner.type] as boolean)
                : undefined
            let carpool: User.Carpool = {
                id: Carpool.fromDynamoDBId(item[skName][skType] as string)
            }
            if (isDefined(isWinner)) carpool = {...carpool, ...{winner: isWinner}}
            return carpool
            }
        )
        return carpools
    }

    async function getCarpoolsHostedBy(userName: string, status: Carpool.Status, operator: string): Promise<User.Carpool[]> {
        return await getCarpoolsRelatedTo(userName, "Host", status, operator)
    }

    export async function getNonClosedCarpoolsHostedBy(userName: string): Promise<User.Carpool[]> {
        return await getCarpoolsHostedBy(userName, App.Table.Attribute.Carpool.Status.Closed, "<>")
    }

    export async function getFullCarpoolsHostedBy(userName: string): Promise<User.Carpool[]> {
        return await getCarpoolsHostedBy(userName, App.Table.Attribute.Carpool.Status.Full, "=")
    }

    export async function getCarpoolsParticipatedBy(userName: string, status?: Carpool.Status, operator?: string): Promise<User.Carpool[]> {
        return await getCarpoolsRelatedTo(userName, "Participant", status, operator)
    }

    export async function getNonClosedCarpoolsParticipatedBy(userName: string): Promise<User.Carpool[]> {
        return await getCarpoolsParticipatedBy(userName, App.Table.Attribute.Carpool.Status.Closed, "<>")
    }

    export async function isHostingNonClosedCarpool(userName: string): Promise<boolean> {
        const carpools: User.Carpool[] = await User.getNonClosedCarpoolsHostedBy(userName)
        return carpools.length != 0
    }

    export async function isParticipantNonClosedCarpool(userName: string): Promise<boolean> {
        const carpools: User.Carpool[] = await User.getNonClosedCarpoolsParticipatedBy(userName)
        return carpools.length != 0
    }

    export async function isHostingFullCarpool(userName: string, carpoolId: string): Promise<boolean> {
        const carpools: User.Carpool[] = await User.getFullCarpoolsHostedBy(userName)
        return (carpools.length == 1) && (carpools[0].id == carpoolId)
    }

    export async function getStartedCarpoolsHostedBy(userName: string): Promise<User.Carpool[]> {
        return await getCarpoolsHostedBy(userName, App.Table.Attribute.Carpool.Status.Started, "=")
    }

    export async function isHostingStartedCarpool(userName: string, carpoolId: string): Promise<boolean> {
        const carpools: User.Carpool[] = await User.getStartedCarpoolsHostedBy(userName)
        return (carpools.length == 1) && (carpools[0].id == carpoolId)
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
            async (event: APIGatewayProxyEvent ) => {
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
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId },
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId }
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
            async (event: APIGatewayProxyEvent ) => {
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
            const input: AWS. DynamoDB.Types.UpdateItemInput = {
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
            async (event: APIGatewayProxyEvent ) => {
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
