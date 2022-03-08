import {Endpoint} from "./Endpoint"
import {APIGatewayProxyEvent} from "aws-lambda"
import {v4 as uuidv4} from "uuid"
import {Application as App, isDefined} from "./Utils"
import * as AWS from "aws-sdk"
import {User} from "./User"

export namespace Carpool {
    const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})

    function toDynamoDBId(id: string): string {
        return `CARPOOL#${id}`
    }

    function fromDynamoDBId(id: string): string {
        return id.split("#")[1]
    }

    export interface Attributes {
        host: string
        genre: string
        licencePlate: string
    }

    export namespace Create {

        async function save(carpool: Carpool): Promise<Carpool> {
            console.log(`Saving carpool=${JSON.stringify(carpool)} into DynamoDB...`)
            const dynamoDBId: string = toDynamoDBId(carpool.id)
            const input: AWS.DynamoDB.Types.PutItemInput = {
                TableName: App.Table.name,
                Item: {
                    [App.Table.pkName]: {S: dynamoDBId},
                    [App.Table.skName]: {S: dynamoDBId},
                    host: {S: carpool.host},
                    genre: {S: carpool.genre},
                    licencePlate: {S: carpool.licencePlate},
                }
            }
            await ddb.putItem(input).promise()
            console.log(`Carpool saved into DynamoDB!`)
            return carpool
        }

        export const endpoint: Endpoint = new Endpoint(
            "/carpool",
            "POST",
            async (event: APIGatewayProxyEvent) => {
                let response: Endpoint.Response
                if (!isDefined(event.body)) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: "body not defined"})
                    }
                } else {
                    const id: string = uuidv4()
                    const attrs: Carpool.Attributes = JSON.parse(event.body)
                    let carpool: Carpool = {id: id, ...attrs}
                    //Save the carpool to datastore
                    try {
                        carpool = await save(carpool)
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

    export namespace Get {

        async function retrieve(carpoolId: string): Promise<Carpool> {
            const dynamoDBId: string = toDynamoDBId(carpoolId)
            const input: AWS.DynamoDB.Types.GetItemInput = {
                TableName: App.Table.name,
                Key: {
                    [App.Table.pkName]: {S: dynamoDBId},
                    [App.Table.skName]: {S: dynamoDBId}
                }
            }
            const output: AWS.DynamoDB.Types.GetItemOutput = await ddb.getItem(input).promise()
            if (!isDefined(output.Item)) throw new Error("DynamoDB.getItem returned undefined")
            const carpool: Carpool = {
                id: carpoolId,
                host: output.Item["host"]["S"] as string,
                genre: output.Item["genre"]["S"] as string,
                licencePlate: output.Item["licencePlate"]["S"] as string,
            }
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

    export namespace Participants {

        export namespace Get {

            async function retrieve(carpoolId: string): Promise<Participants> {
                const input: AWS.DynamoDB.Types.QueryInput = {
                    TableName: App.Table.name,
                    KeyConditionExpression: `${App.Table.pkName} = :x and begins_with(${App.Table.skName}, :y)`,
                    ExpressionAttributeValues: {
                        ":x": {S: toDynamoDBId(carpoolId)},
                        ":y": {S: "USER#"}
                    },
                    Select: "ALL_ATTRIBUTES",
                }
                const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
                if (!isDefined(output.Items)) throw new Error("DynamoDB.query returned undefined")
                const participants: Participants = {
                    participants: output.Items.map(item =>
                        User.fromDynamoDBId(item[App.Table.skName]["S"] as string)
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

        export namespace Add {

            async function update(carpoolId: string, userIds: string[]): Promise<Participants> {
                console.log(`Updating users=${JSON.stringify(userIds)} as participants in carpool=${JSON.stringify(carpoolId)} into DynamoDB...`)
                const input: AWS.DynamoDB.Types.TransactWriteItemsInput = {
                    TransactItems: userIds.map(userId => {
                        return {
                            Put: {
                                TableName: App.Table.name,
                                Item: {
                                    [App.Table.pkName]: {S: toDynamoDBId(carpoolId)},
                                    [App.Table.skName]: {S: User.toDynamoDBId(userId)}
                                }
                            }
                        }
                    })
                }
                await ddb.transactWriteItems(input).promise()
                console.log("Users participation updated!")
                return {
                    participants: userIds
                }
            }

            export const endpoint: Endpoint = new Endpoint(
                "/carpool/{id}/participants",
                "POST",
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
                        const participants: Participants = JSON.parse(event.body)
                        //Update carpool participants into the datastore
                        try {
                            await update(id, participants.participants)
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

export interface Carpool extends Carpool.Attributes {
    id: string
}
