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
endpoints.set(Carpool.Get.ById.endpoint.key, Carpool.Get.ById.endpoint)
endpoints.set(Carpool.Participants.Get.endpoint.key, Carpool.Participants.Get.endpoint)
endpoints.set(Carpool.Join.endpoint.key, Carpool.Join.endpoint)
endpoints.set(Carpool.Start.endpoint.key, Carpool.Start.endpoint)
endpoints.set(Carpool.Close.endpoint.key, Carpool.Close.endpoint)
endpoints.set(Carpool.Get.ByParticipant.endpoint.key, Carpool.Get.ByParticipant.endpoint)
endpoints.set(Carpool.Get.Available.endpoint.key, Carpool.Get.Available.endpoint)
endpoints.set(Carpool.Get.Available.ByGenre.endpoint.key, Carpool.Get.Available.ByGenre.endpoint)

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
