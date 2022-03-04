import {Application, Lambda, ApiGateway} from "@pstorm/aws-cdk"
import * as apigw from '@aws-cdk/aws-apigateway'

const prefixId: string = "cpaniagua-AWS-DynamoDB-Badge-Task-1-CRUD-Application"

const tags: Application.Resource.Tag[] = [
    {key: "owner", value : "claudi.paniagua@devfactory.com"},
    {key: "purpose", value: "https://devgraph-alp.atlassian.net/browse/TPM-2301"}
]

export const app = Application.new( `${prefixId}-app`, "162174280605", "us-east-1","Application.ts")
const lambda: Lambda.Function = new Lambda.Function(
    `${prefixId}-lambda`, "src", tags, "Lambda.handler")
app.addResource(lambda)
const restApi: ApiGateway.RestApi.Lambda = ApiGateway.RestApi.Lambda.new(`${prefixId}-api-gw`, lambda, tags)
const restApiInstance: ApiGateway.RestApi.Instance = app.addResource(restApi) as ApiGateway.RestApi.Instance
const restApiRoot: apigw.IResource = (restApiInstance.asConstruct as apigw.IRestApi).root
const user: apigw.IResource = restApiRoot.addResource("user")
user.addMethod("POST")
const userId: apigw.IResource = user.addResource("{id}")
userId.addMethod("GET")
userId.addMethod("PUT")
const carpool: apigw.IResource = restApiRoot.addResource("carpool")
carpool.addMethod("POST")
const carpoolId: apigw.IResource = carpool.addResource("{id}")
carpoolId.addMethod("GET")
const participants: apigw.IResource = carpoolId.addResource("participants")
participants.addMethod("GET")
participants.addMethod("POST")


