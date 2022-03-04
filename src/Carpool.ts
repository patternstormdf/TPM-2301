import {Endpoint} from "./Endpoint"
import {APIGatewayProxyEvent} from "aws-lambda"
import {v4 as uuidv4} from "uuid"
import {isDefined} from "./Utils"

export namespace Carpool {

    export interface Attributes {
        host: string
        genre: string
        licensePlate: string
    }

    export namespace Create {
        export const endpoint: Endpoint = new Endpoint(
            "/carpool",
            "POST",
            (event: APIGatewayProxyEvent ) => {
                let response: Endpoint.Response
                if (!isDefined(event.body)) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: "body not defined"})
                    }
                } else {
                    const id: string = uuidv4()
                    const attrs: Carpool.Attributes = JSON.parse(event.body)
                    const carpool : Carpool = { id: id, ...attrs}
                    //TODO save the carpool to DynamoDB
                    response = {
                        statusCode: 200,
                        body: JSON.stringify(carpool)
                    }
                }
                return response
            })
    }

    export namespace Get {
        export const endpoint: Endpoint = new Endpoint(
            "/carpool/{id}",
            "GET",
            (event: APIGatewayProxyEvent ) => {
                let response: Endpoint.Response
                if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"])) {
                    response = {
                        statusCode: 400,
                        body: JSON.stringify({error: "id not defined"})
                    }
                } else {
                    const id: string = event.pathParameters["id"]
                    //TODO retrieve carpool from DynamoDB
                    const carpool: Carpool = {
                        id: id,
                        host: "todo",
                        genre: "todo",
                        licensePlate: "todo"
                    }
                    response = {
                        statusCode: 200,
                        body: JSON.stringify(carpool)
                    }
                }
                return response
            })
    }

    export namespace Participants {

        export namespace Get {
            export const endpoint: Endpoint = new Endpoint(
                "/carpool/{id}/participants",
                "GET",
                (event: APIGatewayProxyEvent ) => {
                    let response: Endpoint.Response
                    if (!isDefined(event.pathParameters) || !isDefined(event.pathParameters["id"])) {
                        response = {
                            statusCode: 400,
                            body: JSON.stringify({error: "id not defined"})
                        }
                    } else {
                        const id: string = event.pathParameters["id"]
                        //TODO retrieve carpool participants from DynamoDB
                        const participants: Participants = {
                            participants: []
                        }
                        response = {
                            statusCode: 200,
                            body: JSON.stringify(participants)
                        }
                    }
                    return response
                })
        }

        export namespace Add {
            export const endpoint: Endpoint = new Endpoint(
                "/carpool/{id}/participants",
                "POST",
                (event: APIGatewayProxyEvent ) => {
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
                        //TODO update carpool participants into DynamoDB
                        response = {
                            statusCode: 200,
                            body: JSON.stringify(participants)
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
