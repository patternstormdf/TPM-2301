import {Endpoint} from "./Endpoint"
import {APIGatewayProxyEvent} from "aws-lambda"
import {v4 as uuidv4} from "uuid"
import {Application as App, isDefined} from "./Utils"
import * as AWS from "aws-sdk"
import {User} from "./User"
import {ExpressionAttributeValueMap, TransactWriteItem} from "aws-sdk/clients/dynamodb"

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

    /*TODO
       1) query carpools by the GSI(host,PK) where host = host, filtering by status != closed,
       if the query returns results, the carpool cannot be created because the
       user is already hosting a non-closed carpool.
       2) query items by the GSI(SK,PK) (i.e. inverted index), filtering by status != closed,
       if the query returns results, the carpool cannot be created because the host is
       already participating in a non-closed carpool
       3) set carpool status to available
     */
    export namespace Create {

        async function save(carpool: Carpool.Attributes): Promise<Carpool> {
            console.log(`Saving carpool=${JSON.stringify(carpool)} into DynamoDB...`)
            const id: string = uuidv4()
            const dynamoDBId: string = Carpool.toDynamoDBId(id)
            const input: AWS.DynamoDB.Types.PutItemInput = {
                TableName: App.Table.name,
                Item: {
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId},
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId},
                    [App.Table.Attribute.Carpool.Host.name]: {[App.Table.Attribute.Carpool.Host.type]: carpool.host},
                    [App.Table.Attribute.Carpool.Genre.name]:
                        {[App.Table.Attribute.Carpool.Genre.type]: carpool.genre},
                    [App.Table.Attribute.Carpool.LicencePlate.name]:
                        {[App.Table.Attribute.Carpool.LicencePlate.type]: carpool.licencePlate},
                    [App.Table.Attribute.Carpool.Status.name]:
                        {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Available}
                }
            }
            await ddb.putItem(input).promise()
            console.log(`Carpool saved into DynamoDB!`)
            return {
                ...carpool, ...{id: id, status: App.Table.Attribute.Carpool.Status.Available}
            }
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")

                    const carpoolAttrs: Carpool.Attributes = JSON.parse(event.body)
                    //Validate that the user is not hosting a non-closed carpool
                    if (await User.isHostingNonClosedCarpool(carpoolAttrs.host))
                        throw new Error(`User ${carpoolAttrs.host} is already hosting a Carpool`)
                    //Validate that the user is not participating in a non-closed carpool
                    if (await User.isParticipantNonClosedCarpool(carpoolAttrs.host))
                        throw new Error(`User ${carpoolAttrs.host} is participating in a Carpool`)
                    //Save the carpool to datastore
                    const carpool: Carpool = await save(carpoolAttrs)
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
                return response
            })
    }

    /* TODO
        1) Query by the GSI(SK,PK) with SK = "user joining" and filtering by status != closed, if the query
        return results, the user cannot join because he is a participant in another non-closed carpool
        2) Query by GSI(host,PK) with host = "user joining" and filtering by status != closed, if the query
        return results, the user cannot join because he is a host of a non-closed carpool
        3) Query by (PK,SK) with PK = "carpool to join", if the query has 4 results or more, the user cannot join
        because the carpool already has 4 participants
        4) Save an item (PK, SK) where PK = "carpool to join" and SK = "user to join"
        5) If 3) returned 3 results update the "carpool to join" with status = "ready"
     */
    export namespace Join {

        export type Input = {
            participant: string
        }

        async function update(userName: string, carpoolId: string, participantCount: number): Promise<void> {
            let transactItems: TransactWriteItem[] = [{
                Put: {
                    TableName: App.Table.name,
                    Item: {
                        [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: Carpool.toDynamoDBId(carpoolId)},
                        [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: User.toDynamoDBId(userName)}
                    }
                }
            }]
            if (participantCount == 3) {
                const carpoolDynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
                transactItems = transactItems.concat({
                    Update: {
                        TableName: App.Table.name,
                        Key: {
                            [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: carpoolDynamoDBId},
                            [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId}
                        },
                        UpdateExpression: "set #s = :x",
                        ExpressionAttributeNames: {
                            "#s": App.Table.Attribute.Carpool.Status.name
                        },
                        ExpressionAttributeValues: {
                            ":x": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Full},
                        }
                    }
                })
            }
            const input: AWS.DynamoDB.Types.TransactWriteItemsInput = {TransactItems: transactItems}
            await ddb.transactWriteItems(input).promise()
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool/{id}/join",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"]))
                        throw new Error("Carpool id not defined")
                    const carpoolId: string = event.pathParameters["id"]
                    const body: Input = JSON.parse(event.body)
                    const participant: string = body.participant
                    //Validate that the user joining is not hosting a non-closed carpool
                    if (await User.isHostingNonClosedCarpool(participant))
                        throw new Error(`User ${participant} is already hosting a Carpool`)
                    //Validate that the user joining is not participating in a non-closed carpool
                    if (await User.isParticipantNonClosedCarpool(participant))
                        throw new Error(`User ${participant} is participating in a Carpool`)
                    //Validate that the carpool has less than four participants
                    const participantCount: number = await Carpool.Participants.count(carpoolId)
                    if (participantCount >= 4) throw new Error(`The Carpool ${carpoolId} is full`)
                    //Update the user as carpool participant in the datastore
                    await update(participant, carpoolId, participantCount)
                    response = {
                        statusCode: 200,
                        body: JSON.stringify({})
                    }
                } catch (err: any) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
                return response
            })
    }

    /*
    TODO
     1) query by GSI(host,PK) with host = "user calling" and filtering by status = ready, if the query
     does not return results, the user cannot start the carpool as the user is not hosting any carpool ready to
     be started
     2) update the carpool with status = started
     */
    export namespace Start {

        export type Input = {
            user: string
        }

        async function update(carpoolId: string): Promise<void> {
            const dynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
            const input: AWS.DynamoDB.Types.UpdateItemInput = {
                TableName: App.Table.name,
                Key: {
                    [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: dynamoDBId},
                    [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: dynamoDBId}
                },
                UpdateExpression: "set #s = :x",
                ExpressionAttributeNames: {
                    "#s": App.Table.Attribute.Carpool.Status.name
                },
                ExpressionAttributeValues: {
                    ":x": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Started},
                }
            }
            await ddb.updateItem(input).promise()
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool/{id}/start",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"]))
                        throw new Error("Carpool id not defined")
                    const carpoolId: string = event.pathParameters["id"]
                    const body: Input = JSON.parse(event.body)
                    const userName: string = body.user
                    //Validate that the user is hosting the carpool and the carpool is full
                    if (!(await User.isHostingFullCarpool(userName, carpoolId)))
                        throw new Error(`User ${userName} is not hosting the Carpool ${carpoolId} or the Carpool is not full`)
                    //Update the carpool as started in the datastore
                    await update(carpoolId)
                    response = {
                        statusCode: 200,
                        body: JSON.stringify({})
                    }
                } catch (err: any) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
                return response
            })
    }

    /* TODO
        1) query by GSI(PK,host) with host = "user calling" and filtering by status = started, if the query
        does not return results, the user cannot close the carpool as the user is not hosting any ongoing carpool
        2) update the carpool with status = closed and winner = winner
        3) update the participants with status = closed and the winner with isWinner = true
     */
    export namespace Close {

        export type Input = {
            user: string
            winner: string
        }

        async function update(carpoolId: string, winner: string, participants: string[]): Promise<void> {
            const carpoolDynamoDBId: string = Carpool.toDynamoDBId(carpoolId)
            let transactItems: TransactWriteItem[] = [{
                Update: {
                    TableName: App.Table.name,
                    Key: {
                        [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: carpoolDynamoDBId},
                        [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: carpoolDynamoDBId}
                    },
                    UpdateExpression: `set #s = :x, ${App.Table.Attribute.Carpool.Winner.name} = :y`,
                    ExpressionAttributeNames: {
                        "#s": App.Table.Attribute.Carpool.Status.name
                    },
                    ExpressionAttributeValues: {
                        ":x": {[App.Table.Attribute.Carpool.Status.type]: App.Table.Attribute.Carpool.Status.Closed},
                        ":y": {[App.Table.Attribute.Carpool.Winner.type]: winner},
                    }
                }
            }]
            transactItems = transactItems.concat(participants.map(participant => {
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
                            [App.Table.Key.Primary.name]: {[App.Table.Key.Primary.type]: carpoolDynamoDBId},
                            [App.Table.Key.Sort.name]: {[App.Table.Key.Sort.type]: User.toDynamoDBId(participant)}
                        },
                        UpdateExpression: updateExpression,
                        ExpressionAttributeValues: expressionAttributeValues,
                        ExpressionAttributeNames: {"#s": App.Table.Attribute.Carpool.Status.name}
                    }
                }
            }))
            const input: AWS.DynamoDB.Types.TransactWriteItemsInput = {
                TransactItems: transactItems
            }
            await ddb.transactWriteItems(input).promise()
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool/{id}/end",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                try {
                    if (!isDefined(event.body)) throw new Error("body not defined")
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"]))
                        throw new Error("Carpool id not defined")
                    const carpoolId: string = event.pathParameters["id"]
                    const body: Input = JSON.parse(event.body)
                    const userName: string = body.user
                    //Validate that the user is hosting the carpool and the carpool has started
                    if (!(await User.isHostingStartedCarpool(userName, carpoolId)))
                        throw new Error(`User ${userName} is not hosting the Carpool ${carpoolId} or the Carpool has not started`)
                    //Get the Carpool participants to update their status
                    const participants: Participants = await Carpool.Participants.Get.retrieve(carpoolId)
                    //Update the carpool as closed with the winner in the datastore
                    await update(carpoolId, body.winner, participants.participants)
                    response = {
                        statusCode: 200,
                        body: JSON.stringify({})
                    }
                } catch (err: any) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: err.message})
                    }
                }
                return response
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

        //TODO query by GSI(SK,PK) where user = participant returning the field winner
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
                            const carpools: User.Carpool[] = await User.getCarpoolsParticipatedBy(userName)
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

        //TODO query the carpools by the GSI(status, PK) where status = available
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

            //TODO query the carpools by the GSI(status,PK) wuth status = available and filtering by genre
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

    export namespace Participants {

        export async function count(carpoolId: string): Promise<number> {
            const participants: Participants = await Participants.Get.retrieve(carpoolId, true)
            return participants.participants.length
        }

        export namespace Get {

            export async function retrieve(carpoolId: string, consistentRead: boolean = false): Promise<Participants> {
                const input: AWS.DynamoDB.Types.QueryInput = {
                    TableName: App.Table.name,
                    KeyConditionExpression: `${App.Table.Key.Primary.name} = :x and begins_with(${App.Table.Key.Sort.name}, :y)`,
                    ExpressionAttributeValues: {
                        ":x": {[App.Table.Key.Primary.type]: Carpool.toDynamoDBId(carpoolId)},
                        ":y": {[App.Table.Key.Sort.type]: User.prefixId}
                    },
                    Select: "ALL_ATTRIBUTES",
                    ConsistentRead: consistentRead
                }
                const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
                if (!isDefined(output.Items)) throw new Error("DynamoDB.query returned undefined")
                const participants: Participants = {
                    participants: output.Items.map(item =>
                        User.fromDynamoDBId(item[App.Table.Key.Sort.name][App.Table.Key.Sort.type] as string)
                    )
                }
                return participants
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

