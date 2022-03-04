import {APIGatewayProxyEvent} from "aws-lambda"
import {v4 as uuidv4} from "uuid"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"

export namespace User {

    export interface Location {
        longitude: number
        latitude: number
    }

    export interface Attributes extends Location {
        name: string
    }

    export namespace Create {

        export const endpoint: Endpoint = new Endpoint(
            "/user",
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
                    const attrs: User.Attributes = JSON.parse(event.body)
                    const user : User = { id: id, ...attrs}
                    //TODO save the user to DynamoDB
                    response = {
                        statusCode: 200,
                        body: JSON.stringify(user)
                    }
                }
                return response
            })
    }

    export namespace Get {
        export const endpoint: Endpoint = new Endpoint(
            "/user/{id}",
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
                    //TODO retrieve user from DynamoDB
                    const user: User = {
                        id: id,
                        latitude: 0,
                        longitude: 0,
                        name: "todo"
                    }
                    response = {
                        statusCode: 200,
                        body: JSON.stringify(user)
                    }
                }
                return response
            })
    }

    export namespace Update {
        export const endpoint: Endpoint = new Endpoint(
            "/user/{id}",
            "PUT",
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
                    const location: User.Location = JSON.parse(event.body)
                    const user : User = { id: id, name: "todo", ...location}
                    //TODO update user into DynamoDB
                    response = {
                        statusCode: 200,
                        body: JSON.stringify(user)
                    }
                }
                return response
            })
    }
}

export interface User extends User.Attributes {
    id: string
}
