import {Endpoint} from "./Endpoint"
import {APIGatewayProxyEvent} from "aws-lambda"
import {v4 as uuidv4} from "uuid"
import {Application as App, delay, isDefined} from "./Utils"
import * as AWS from "aws-sdk"
import {User} from "./User"
import {ExpressionAttributeValueMap, ExpressionAttributeNameMap, TransactWriteItem} from "aws-sdk/clients/dynamodb"

export interface Carpool extends Carpool.Attributes {
    id: string
    status: Carpool.Status
    winner?: string
}

export namespace Carpool {

    const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})
    const prefixId: string = "CARPOOL"
    const prefixIdSeparator: string = "#"

    export function toDynamoDBId(id: string): string {
        return `${prefixId}${prefixIdSeparator}${id}`
    }

    export function fromDynamoDBId(id: string): string {
        return id.split(prefixIdSeparator)[1]
    }

    export interface Attributes {
        host: string
        genre: string
        licencePlate: string
    }

    export type Status = typeof App.Table.Attribute.Carpool.Status.Available |
        typeof App.Table.Attribute.Carpool.Status.Full |
        typeof App.Table.Attribute.Carpool.Status.Started |
        typeof App.Table.Attribute.Carpool.Status.Closed

    export namespace Create {

        async function save(carpool: Carpool.Attributes): Promise<Carpool> {
            console.log(`Saving carpool=${JSON.stringify(carpool)} into DynamoDB...`)
            const id: string = uuidv4()
            const carpoolDynamoDBId: string = Carpool.toDynamoDBId(id)
            const hostDynamoDBId: string = User.toDynamoDBId(carpool.host)
            const input: AWS.DynamoDB.Types.TransactWriteItemsInput = {
                TransactItems: [
                    {
                        Put: {
                            TableName: App.Table.name,
                            Item: {
                                [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: carpoolDynamoDBId},
                                [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId},
                                [App.Table.Attribute.Carpool.Host.name]: {[App.Table.Attribute.Carpool.Host.type]: carpool.host},
                                [App.Table.Attribute.Carpool.Genre.name]:
                                    {[App.Table.Attribute.Carpool.Genre.type]: carpool.genre},
                                [App.Table.Attribute.Carpool.LicencePlate.name]:
                                    {[App.Table.Attribute.Carpool.LicencePlate.type]: carpool.licencePlate},
                                [App.Table.Attribute.Carpool.Participants.name]:
                                    {[App.Table.Attribute.Carpool.Participants.type]: "0"},
                                [App.Table.Attribute.Carpool.Status.name]:
                                    {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Available}
                            }
                        }
                    },
                    {
                        Put: {
                            TableName: App.Table.name,
                            Item: {
                                [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: hostDynamoDBId},
                                [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId},
                                [App.Table.Attribute.User.IsHost.name]: {[App.Table.Attribute.User.IsHost.type]: true}
                            }
                        }
                    }
                ]
            }
            await ddb.transactWriteItems(input).promise()
            console.log(`Carpool saved into DynamoDB!`)
            return {
                ...carpool, ...{id: id, status: App.Table.Attribute.Carpool.Status.Available}
            }
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    const carpoolAttrs: Carpool.Attributes = JSON.parse(event.body)

                    return await App.Table.Lock.dispatch(async () => {
                        //Validate that the user is not hosting a non-closed carpool
                        if (await User.isHostingNonClosedCarpool(carpoolAttrs.host, true))
                            throw new Error(`User ${carpoolAttrs.host} is already hosting a Carpool`)
                        //Validate that the user is not participating in a non-closed carpool
                        if (await User.isParticipantNonClosedCarpool(carpoolAttrs.host, true))
                            throw new Error(`User ${carpoolAttrs.host} is participating in a Carpool`)
                        //Save the carpool to datastore
                        const carpool: Carpool = await save(carpoolAttrs)
                        return {
                            statusCode: 200,
                            body: JSON.stringify(carpool)
                        }
                    })
                } catch (err: any) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
            })
    }

    export namespace Join {

        export type Input = {
            participant: string
        }

        async function update(userName: string, carpoolId: string, participantCount: number): Promise<void> {
            let transactItems: TransactWriteItem[] = [{
                Put: {
                    TableName: App.Table.name,
                    Item: {
                        [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: User.toDynamoDBId(userName)},
                        [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: Carpool.toDynamoDBId(carpoolId)}
                    }
                }
            }]
            let updateExpression: string = `set #p = :y`
            let expressionAttributeNames: ExpressionAttributeNameMap = {
                "#p": App.Table.Attribute.Carpool.Participants.name
            }
            let expressionAttributeValues: ExpressionAttributeValueMap = {
                ":y": {[App.Table.Attribute.Carpool.Participants.type]: (participantCount + 1).toString()},
            }
            if (participantCount == 3) {
                updateExpression = `${updateExpression}, #s = :x`
                expressionAttributeNames = {...expressionAttributeNames, ...{
                        "#s": App.Table.Attribute.Carpool.Status.name
                    }}
                expressionAttributeValues = {...expressionAttributeValues, ...{
                        ":x": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Full}
                    }}
            }
            const carpoolDynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
            const transactItem: TransactWriteItem = {
                Update: {
                    TableName: App.Table.name,
                    Key: {
                        [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: carpoolDynamoDBId},
                        [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId}
                    },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues
                }
            }
            transactItems = transactItems.concat(transactItem)
            const input: AWS.DynamoDB.Types.TransactWriteItemsInput = {TransactItems: transactItems}
            await ddb.transactWriteItems(input).promise()
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool/{id}/join",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"]))
                        throw new Error("Carpool id not defined")
                    const carpoolId: string = event.pathParameters["id"]
                    const body: Input = JSON.parse(event.body)
                    const participant: string = body.participant
                    return await App.Table.Lock.dispatch(async () => {
                        //Validate that the user joining is not hosting a non-closed carpool
                        if (await User.isHostingNonClosedCarpool(participant, true))
                            throw new Error(`User ${participant} is already hosting a Carpool`)
                        //Validate that the user joining is not participating in a non-closed carpool
                        if (await User.isParticipantNonClosedCarpool(participant, true))
                            throw new Error(`User ${participant} is participating in a Carpool`)
                        //Validate that the carpool has less than four participants
                        const participantCount: number = await Carpool.Participants.count(carpoolId, true)
                        if (participantCount >= 4) throw new Error(`The Carpool ${carpoolId} is full`)
                        //Update the user as carpool participant in the datastore
                        await update(participant, carpoolId, participantCount)
                        return {
                            statusCode: 200,
                            body: JSON.stringify({})
                        }
                    })
                } catch (err: any) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
            })
    }

    export namespace Start {

        export type Input = {
            user: string
        }

        async function update(carpoolId: string, host: string): Promise<void> {
            const carpoolDynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
            const input: AWS.DynamoDB.Types.UpdateItemInput = {
                TableName: App.Table.name,
                Key: {
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: carpoolDynamoDBId},
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId}
                },
                //Validate that the user is hosting the carpool and the carpool is full
                ConditionExpression: `#s = :y and ${App.Table.Attribute.Carpool.Host.name} = :h`,
                UpdateExpression: "set #s = :x",
                ExpressionAttributeNames: {
                    "#s": App.Table.Attribute.Carpool.Status.name
                },
                ExpressionAttributeValues: {
                    ":x": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Started},
                    ":y": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Full},
                    ":h": {[App.Table.Attribute.Carpool.Host.type]: host}
                }
            }
            await ddb.updateItem(input).promise()
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool/{id}/start",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"]))
                        throw new Error("Carpool id not defined")
                    const carpoolId: string = event.pathParameters["id"]
                    const body: Input = JSON.parse(event.body)
                    const userName: string = body.user
                    return await App.Table.Lock.dispatch(async () => {
                        //Update the carpool as started in the datastore
                        await update(carpoolId, userName)
                        return {
                            statusCode: 200,
                            body: JSON.stringify({})
                        }
                    })
                } catch (err: any) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
            })
    }

    export namespace Close {

        export type Input = {
            user: string
            winner: string
        }

        async function update(carpoolId: string, host: string, winner: string, users: Carpool.Users): Promise<void> {
            const carpoolDynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
            let transactItems: TransactWriteItem[] = [{
                Update: {
                    TableName: App.Table.name,
                    Key: {
                        [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: carpoolDynamoDBId},
                        [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId}
                    },
                    //Validate that the user is hosting the carpool and the carpool has started
                    ConditionExpression: `#s = :z and ${App.Table.Attribute.Carpool.Host.name} = :h`,
                    UpdateExpression: `set #s = :x, ${App.Table.Attribute.Carpool.Winner.name} = :y`,
                    ExpressionAttributeNames: {
                        "#s": App.Table.Attribute.Carpool.Status.name
                    },
                    ExpressionAttributeValues: {
                        ":x": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Closed},
                        ":y": {[App.Table.Attribute.Carpool.Winner.type]: winner},
                        ":z": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Started},
                        ":h": {[App.Table.Attribute.Carpool.Host.type]: host},
                    }
                }
            }]
            transactItems = transactItems.concat(users.participants.map(participant => {
                const updateExpression: string = (participant == winner) ?
                    `set ${App.Table.Attribute.User.IsWinner.name} = :x, #s = :y` : "set #s = :y"
                const expressionAttributeValues: ExpressionAttributeValueMap = (participant == winner) ? {
                    ":x": {[App.Table.Attribute.User.IsWinner.type]: true},
                    ":y": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Closed}
                } : {":y": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Closed}}
                return {
                    Update: {
                        TableName: App.Table.name,
                        Key: {
                            [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: User.toDynamoDBId(participant)},
                            [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId},
                        },
                        UpdateExpression: updateExpression,
                        ExpressionAttributeValues: expressionAttributeValues,
                        ExpressionAttributeNames: {"#s": App.Table.Attribute.Carpool.Status.name}
                    }
                }
            }))
            transactItems = transactItems.concat({
                Update: {
                    TableName: App.Table.name,
                    Key: {
                        [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: User.toDynamoDBId(users.host)},
                        [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId}
                    },
                    UpdateExpression: "set #s = :x",
                    ExpressionAttributeValues: {
                        ":x": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Closed}
                    },
                    ExpressionAttributeNames: {
                        "#s": App.Table.Attribute.Carpool.Status.name
                    }
                }
            })
            const input: AWS.DynamoDB.Types.TransactWriteItemsInput = {
                TransactItems: transactItems
            }
            await ddb.transactWriteItems(input).promise()
        }

        //This function ensures a consistent read in the Carpool-User GSI for started Carpools
        async function retrieveUsers(carpoolId: string, retries: number = 0): Promise<Carpool.Users> {
            if (retries == 20) throw new Error(`Timeout waiting for the GSI Carpool-User to become consistent`)
            try {
                const users: Carpool.Users = await Carpool.Users.retrieve(carpoolId)
                if (users.participants.length != 4) {
                    await delay(500)
                    return await retrieveUsers(carpoolId, retries + 1)
                }
                return users
            } catch (err: any) {
                if (err.message.includes("has no host")) {
                    await delay(500)
                    return await retrieveUsers(carpoolId, retries + 1)
                }
                throw err
            }
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool/{id}/end",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"]))
                        throw new Error("Carpool id not defined")
                    const carpoolId: string = event.pathParameters["id"]
                    const body: Input = JSON.parse(event.body)
                    const userName: string = body.user
                    return await App.Table.Lock.dispatch(async () => {
                        //Get the Carpool's participants and host to update their status
                        const users: Carpool.Users = await retrieveUsers(carpoolId) //Carpool.Users.retrieve(carpoolId)
                        //Update the carpool as closed with the winner in the datastore
                        await update(carpoolId, userName, body.winner, users)
                        return {
                            statusCode: 200,
                            body: JSON.stringify({})
                        }
                    })
                } catch (err: any) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
            })

    }

    export namespace Get {

        export namespace ById {

            async function retrieve(carpoolId: string): Promise<Carpool> {
                const dynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
                const input: AWS.DynamoDB.Types.GetItemInput = {
                    TableName: App.Table.name,
                    Key: {
                        [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId},
                        [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId}
                    }
                }
                const output: AWS.DynamoDB.Types.GetItemOutput = await ddb.getItem(input).promise()
                if (!isDefined(output.Item)) throw new Error("DynamoDB.getItem returned undefined")
                const winner: string | undefined = isDefined(output.Item[App.Table.Attribute.Carpool.Winner.name]) ?
                    (output.Item[App.Table.Attribute.Carpool.Winner.name][App.Table.Attribute.Carpool.Winner.type] as string)
                    : undefined
                let carpool: Carpool = {
                    id: carpoolId,
                    host: output.Item[App.Table.Attribute.Carpool.Host.name]
                        [App.Table.Attribute.Carpool.Host.type] as string,
                    genre: output.Item[App.Table.Attribute.Carpool.Genre.name]
                        [App.Table.Attribute.Carpool.Genre.type] as string,
                    licencePlate: output.Item[App.Table.Attribute.Carpool.LicencePlate.name]
                        [App.Table.Attribute.Carpool.LicencePlate.type] as string,
                    status: output.Item[App.Table.Attribute.Carpool.Status.name]
                        [App.Table.Attribute.Carpool.Status.type] as string
                }
                if (isDefined(winner)) carpool = {...carpool, ...{winner: winner}}
                return carpool
            }

            export const endpoint: Endpoint = new Endpoint(
                "/carpool/{id}",
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
                        //Retrieve carpool from the datastore
                        try {
                            const carpool: Carpool = await retrieve(id)
                            response = {
                                statusCode: 200,
                                body: JSON.stringify(carpool)
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

        export namespace ByParticipant {

            export const endpoint: Endpoint = new Endpoint(
                "/carpool/participants/{id}",
                "GET",
                async (event: APIGatewayProxyEvent) => {
                    let response: Endpoint.Response
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"])) {
                        response = {
                            statusCode: 400,
                            body: JSON.stringify({error: "id not defined"})
                        }
                    } else {
                        const userName: string = event.pathParameters["id"]
                        //Retrieve carpools participated by the user from the datastore
                        try {
                            const carpools: User.Carpool[] = await User.getCarpoolsParticipatedBy(userName, false)
                            response = {
                                statusCode: 200,
                                body: JSON.stringify(carpools)
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

        export namespace Available {

            export async function retrieve(genre?: string): Promise<Carpool[]> {
                let input: AWS.DynamoDB.Types.QueryInput = {
                    TableName: App.Table.name,
                    IndexName: App.Table.GSI.StatusCarpool.name,
                    KeyConditionExpression: `#s = :x`,
                    ExpressionAttributeNames: {
                        "#s": App.Table.GSI.StatusCarpool.Key.Primary.name
                    },
                    ExpressionAttributeValues: {
                        ":x": {[App.Table.GSI.StatusCarpool.Key.Primary.type]: App.Table.Attribute.Carpool.Status.Available}
                    },
                    Select: "ALL_PROJECTED_ATTRIBUTES"
                }
                if (isDefined(genre))
                    input = {
                        ...input, ...{
                            FilterExpression: `${App.Table.Attribute.Carpool.Genre.name} = :y`,
                            ExpressionAttributeValues: {
                                ...input.ExpressionAttributeValues,
                                ...{":y": {[App.Table.Attribute.Carpool.Genre.type]: genre}}
                            }
                        }
                    }
                const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
                if (!isDefined(output.Items)) throw new Error("DynamoDB.query returned undefined")
                const carpools: Carpool[] = output.Items.map(item => {
                    return {
                        id: Carpool.fromDynamoDBId(
                            item[App.Table.GSI.StatusCarpool.Key.Sort.name][App.Table.GSI.StatusCarpool.Key.Sort.type] as string
                        ),
                        host: item[App.Table.Attribute.Carpool.Host.name][App.Table.Attribute.Carpool.Host.type] as string,
                        genre: item[App.Table.Attribute.Carpool.Genre.name][App.Table.Attribute.Carpool.Genre.type] as string,
                        status: item[App.Table.GSI.StatusCarpool.Key.Primary.name][App.Table.GSI.StatusCarpool.Key.Primary.type] as string,
                        licencePlate: item[App.Table.Attribute.Carpool.LicencePlate.name][App.Table.Attribute.Carpool.LicencePlate.type] as string,
                    }
                })
                return carpools
            }

            export const endpoint: Endpoint = new Endpoint(
                "/carpool/available",
                "GET",
                async (event: APIGatewayProxyEvent) => {
                    let response: Endpoint.Response
                    try {
                        //Retrieve available Carpools from the datastore
                        const carpools: Carpool[] = await retrieve()
                        response = {
                            statusCode: 200,
                            body: JSON.stringify(carpools)
                        }
                    } catch (err: any) {
                        response = {
                            statusCode: 400,
                            body: JSON.stringify({error: err.message})
                        }
                    }
                    return response
                })

            export namespace ByGenre {

                export const endpoint: Endpoint = new Endpoint(
                    "/carpool/available/genre/{genre}",
                    "GET",
                    async (event: APIGatewayProxyEvent) => {
                        let response: Endpoint.Response
                        if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["genre"])) {
                            response = {
                                statusCode: 400,
                                body: JSON.stringify({error: "genre not defined"})
                            }
                        } else {
                            const genre: string = event.pathParameters["genre"]
                            //Retrieve available carpools of the specific genre from the datastore
                            try {
                                const carpools: User.Carpool[] = await Available.retrieve(genre)
                                response = {
                                    statusCode: 200,
                                    body: JSON.stringify(carpools)
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
    }

    export namespace Users {

        export async function retrieve(carpoolId: string): Promise<Users> {
            const input: AWS.DynamoDB.Types.QueryInput = {
                TableName: App.Table.name,
                IndexName: App.Table.GSI.CarpoolUser.name,
                KeyConditionExpression: `${App.Table.GSI.CarpoolUser.Key.Primary.name} = :x and begins_with(${App.Table.GSI.CarpoolUser.Key.Sort.name}, :y)`,
                ExpressionAttributeValues: {
                    ":x": {[App.Table.GSI.CarpoolUser.Key.Primary.type]: Carpool.toDynamoDBId(carpoolId)},
                    ":y": {[App.Table.GSI.CarpoolUser.Key.Sort.type]: User.prefixId}
                },
                Select: "ALL_PROJECTED_ATTRIBUTES"
            }
            const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
            if (!isDefined(output.Items)) throw new Error("DynamoDB.query returned undefined")
            let participants: string[] = []
            let host: string | undefined
            output.Items.map(item => {
                if (isDefined(item[App.Table.Attribute.User.IsHost.name]))
                    host = User.fromDynamoDBId(
                        item[App.Table.GSI.CarpoolUser.Key.Sort.name][App.Table.GSI.CarpoolUser.Key.Sort.type] as string
                    )
                else participants = participants.concat(
                    User.fromDynamoDBId(
                        item[App.Table.GSI.CarpoolUser.Key.Sort.name][App.Table.GSI.CarpoolUser.Key.Sort.type] as string
                    )
                )
            })
            if (!isDefined(host)) throw Error(`The Carpool ${carpoolId} has no host`)
            return {
                participants: participants,
                host: host
            }
        }
    }

    export interface Users extends Participants {
        host: string
    }

    export namespace Participants {

        export async function count(carpoolId: string, consistent: boolean): Promise<number> {
            const dynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
            const input: AWS.DynamoDB.Types.GetItemInput = {
                TableName: App.Table.name,
                Key: {
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId},
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId}
                },
                ConsistentRead: consistent
            }
            const output: AWS.DynamoDB.Types.GetItemOutput = await ddb.getItem(input).promise()
            if (!isDefined(output.Item)) throw new Error("DynamoDB.getItem returned undefined")
            const participantCount: number | undefined =
                +(output.Item[App.Table.Attribute.Carpool.Participants.name][App.Table.Attribute.Carpool.Participants.type] as string)
            if (!isDefined(participantCount)) throw new Error(`Carpool ${carpoolId} has not the participant count stored`)
            return participantCount
        }

        export namespace Get {

            export async function retrieve(carpoolId: string): Promise<Participants> {
                const users: Users = await Users.retrieve(carpoolId)
                return {
                    participants: users.participants
                }
            }

            export const endpoint: Endpoint = new Endpoint(
                "/carpool/{id}/participants",
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
                        //Retrieve carpool participants from DynamoDB
                        try {
                            const participants: Participants = await retrieve(id)
                            response = {
                                statusCode: 200,
                                body: JSON.stringify(participants)
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

    export interface Participants {
        participants: string[]
    }
}

