import {APIGatewayProxyEvent} from "aws-lambda"
import {v4 as uuidv4} from "uuid"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"
import {Application as App} from "./Utils"
import * as AWS from "aws-sdk"

export namespace User {
    const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: App.region})

    export interface Location {
        longitude: number
        latitude: number
    }

    export interface Attributes extends Location {
        name: string
    }

    export function toDynamoDBId(id: string): string {
        return `USER#${id}`
    }

    export function fromDynamoDBId(id: string): string {
        return id.split("#")[1]
    }

    export namespace Create {

        async function save(user: User): Promise<User> {
            console.log(`Saving user=${JSON.stringify(user)} into DynamoDB...`)
            const input: AWS.DynamoDB.Types.PutItemInput = {
                TableName: App.Table.name,
                Item: {
                    [App.Table.pkName]: {S: toDynamoDBId(user.id)},
                    name: {S: user.name},
                    longitude: {N: user.longitude.toString()},
                    latitude: {N: user.latitude.toString()},
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
                    const id: string = uuidv4()
                    const attrs: User.Attributes = JSON.parse(event.body)
                    let user : User = { id: id, ...attrs}
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
            const input: AWS.DynamoDB.Types.GetItemInput = {
                TableName: App.Table.name,
                Key: { [App.Table.pkName]: { S: toDynamoDBId(userId) } }
            }
            const output: AWS.DynamoDB.Types.GetItemOutput = await ddb.getItem(input).promise()
            if (!isDefined(output.Item)) throw new Error("DynamoDB.getItem returned undefined")
            const user: User = {
                id: userId,
                name: output.Item["name"]["S"] as string,
                longitude: +(output.Item["longitude"]["N"] as string),
                latitude: +(output.Item["latitude"]["N"] as string)
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
            const input: AWS. DynamoDB.Types.UpdateItemInput = {
                TableName: App.Table.name,
                Key: { [App.Table.pkName]: {S: toDynamoDBId(userId)} },
                UpdateExpression: "set longitude = :x, latitude = :y",
                ExpressionAttributeValues: {
                    ":x": {N: location.longitude.toString()},
                    ":y": {N: location.latitude.toString()}
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

export interface User extends User.Attributes {
    id: string
}
