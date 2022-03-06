import {APIGatewayProxyEvent, Context} from "aws-lambda"
import {User} from "./User"
import {Carpool} from "./Carpool"
import {Endpoint} from "./Endpoint"
import {isDefined} from "./Utils"

const endpoints: Map<string, Endpoint> = new Map()
endpoints.set(User.Create.endpoint.key, User.Create.endpoint)
endpoints.set(User.Get.endpoint.key, User.Get.endpoint)
endpoints.set(User.Update.endpoint.key, User.Update.endpoint)
endpoints.set(Carpool.Create.endpoint.key, Carpool.Create.endpoint)
endpoints.set(Carpool.Get.endpoint.key, Carpool.Get.endpoint)
endpoints.set(Carpool.Participants.Get.endpoint.key, Carpool.Participants.Get.endpoint)
endpoints.set(Carpool.Participants.Add.endpoint.key, Carpool.Participants.Add.endpoint)

export async function handler(event: APIGatewayProxyEvent, context?: Context): Promise<any> {
    console.log(`=>Lambda.handler(event=${JSON.stringify(event)} context=${JSON.stringify(context)})`)
    let response: Endpoint.Response
    if (!isDefined(event)) {
        response = {
            statusCode: 400,
            body: JSON.stringify({error: "event is undefined"})
        }
    } else {
        const endpointKey: string = Endpoint.key(event.resource, event.httpMethod as Endpoint.Method)
        const endpoint: Endpoint | undefined = endpoints.get(endpointKey)
        if (!isDefined(endpoint)) {
            response = {
                statusCode: 400,
                body: JSON.stringify({error: `method=${event.httpMethod} on resource=${event.resource} is not supported`})
            }
        } else {
            response = await endpoint.execute(event)
        }
    }
    console.log(`<=Lambda.handler output=${JSON.stringify(response)}`)
    return response
}
