import {APIGatewayProxyEvent} from "aws-lambda"
import {APIGatewayProxyResult} from "aws-lambda/trigger/api-gateway-proxy";

export namespace Endpoint {
    export type Method = "POST" | "GET" | "PUT"

    export type Handler = (event: APIGatewayProxyEvent) => APIGatewayProxyResult

    export type Response = APIGatewayProxyResult
}

export class Endpoint {
    resource: string
    method: Endpoint.Method
    handler: Endpoint.Handler

    static key(resource: string, method: Endpoint.Method): string {
        return `${resource}.${method}`
    }

    constructor(resource: string, method: Endpoint.Method, handler: Endpoint.Handler) {
        this.resource = resource
        this.method = method
        this.handler = handler
    }

    get key(): string {
        return Endpoint.key(this.resource, this.method)
    }

    execute(event: APIGatewayProxyEvent): Endpoint.Response {
        console.log(`resource=${this.resource} method=${this.method} event=${JSON.stringify(event)}`)
        const response: Endpoint.Response = this.handler(event)
        console.log(`response=${JSON.stringify(response)}`)
        return response
    }
}
