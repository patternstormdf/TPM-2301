import {APIGatewayProxyEvent} from "aws-lambda"
import {APIGatewayProxyResult} from "aws-lambda/trigger/api-gateway-proxy";

export namespace Endpoint {
    export type Method = "POST" | "GET" | "PUT"

    export type Handler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>

    export type Response = APIGatewayProxyResult
}

export class Endpoint {
    resource: string
    method: Endpoint.Method
    handler: Endpoint.Handler

    static key(resource: string, method: Endpoint.Method): string {
        return `${method} ${resource}`
    }

    constructor(resource: string, method: Endpoint.Method, handler: Endpoint.Handler) {
        this.resource = resource
        this.method = method
        this.handler = handler
    }

    get key(): string {
        return Endpoint.key(this.resource, this.method)
    }

    async execute(event: APIGatewayProxyEvent): Promise<Endpoint.Response> {
        console.log(`resource=${this.resource} method=${this.method} event=${JSON.stringify(event)}`)
        const response: Endpoint.Response = await this.handler(event)
        console.log(`response=${JSON.stringify(response)}`)
        return response
    }
}
