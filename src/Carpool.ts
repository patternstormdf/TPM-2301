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
        licensePlate: string
    }

    export namespace Create {

        async function save(carpool: Carpool): Promise<Carpool> {
            console.log(`Saving carpool=${JSON.stringify(carpool)} into DynamoDB...`)
            const input: AWS.DynamoDB.Types.PutItemInput = {
                TableName: App.Table.name,
                Item: {
                    [App.Table.pkName]: {S: toDynamoDBId(carpool.id)},
                    host: {S: carpool.host},
                    genre: {S: carpool.genre},
                    licensePlate: {S: carpool.licensePlate},
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
            const input: AWS.DynamoDB.Types.GetItemInput = {
                TableName: App.Table.name,
                Key: {[App.Table.pkName]: {S: toDynamoDBId(carpoolId)}}
            }
            const output: AWS.DynamoDB.Types.GetItemOutput = await ddb.getItem(input).promise()
            if (!isDefined(output.Item)) throw new Error("DynamoDB.getItem returned undefined")
            const carpool: Carpool = {
                id: carpoolId,
                host: output.Item["host"]["S"] as string,
                genre: output.Item["genre"]["S"] as string,
                licensePlate: output.Item["licensePlate"]["S"] as string,
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

            async function retrieve(carpoolId: string): Promise<User[]> {
                const input: AWS.DynamoDB.Types.QueryInput = {
                    TableName: App.Table.name,
                    IndexName: App.Table.gsiName,
                    KeyConditionExpression: `${App.Table.gsiPkName} = :x`,
                    ExpressionAttributeValues: { ":x": {S: toDynamoDBId(carpoolId)} },
                    Select: "SPECIFIC_ATTRIBUTES",
                    ProjectionExpression: `${App.Table.gsiSkName}, #name, longitude, latitude`,
                    ExpressionAttributeNames: { "#name": "name"}
                }
                const output: AWS.DynamoDB.Types.QueryOutput = await ddb.query(input).promise()
                if (!isDefined(output.Items)) throw new Error("DynamoDB.query returned undefined")
                const users: User[] = output.Items.map(item => {
                    return {
                        id: User.fromDynamoDBId(item[App.Table.gsiSkName]["S"] as string),
                        name: item["name"]["S"] as string,
                        longitude: +(item["longitude"]["N"] as string),
                        latitude: +(item["latitude"]["N"] as string)
                    }
                })
                return users
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
                            const users: User[] = await retrieve(id)
                            response = {
                                statusCode: 200,
                                body: JSON.stringify(users)
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
                            Update: {
                                TableName: App.Table.name,
                                Key: {[App.Table.pkName]: {S: User.toDynamoDBId(userId)}},
                                UpdateExpression: "set #pk = :x, #sk = :y",
                                ExpressionAttributeNames: {
                                    "#pk": App.Table.gsiPkName,
                                    "#sk": App.Table.gsiSkName,
                                },
                                ExpressionAttributeValues: {
                                    ":x": {S: toDynamoDBId(carpoolId)},
                                    ":y": {S: User.toDynamoDBId(userId)}
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
