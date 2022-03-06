import {Application, Lambda, ApiGateway, DynamoDB, IAM} from "@pstorm/aws-cdk"
import * as apigw from '@aws-cdk/aws-apigateway'
import * as ddb from '@aws-cdk/aws-dynamodb'
import {Application as App} from "./src/Utils"

const tags: Application.Resource.Tag[] = [
    {key: "owner", value : "claudi.paniagua@devfactory.com"},
    {key: "purpose", value: "https://devgraph-alp.atlassian.net/browse/TPM-2301"}
]

export const app = Application.new( `${App.prefixId}-app`, App.account, App.region,"Application.ts")

const table: DynamoDB.Table = DynamoDB.Table.new(App.Table.name, tags,
    App.Table.pkName, App.Table.pkType)
const tableInstance: DynamoDB.Table.Instance = app.addResource(table) as DynamoDB.Table.Instance
const tableConstruct: ddb.Table = tableInstance.asConstruct as ddb.Table
tableConstruct.addGlobalSecondaryIndex({
    indexName: App.Table.gsiName,
    projectionType: ddb.ProjectionType.INCLUDE,
    nonKeyAttributes: ["name", "longitude", "latitude"],
    partitionKey: {
        name: App.Table.gsiPkName,
        type: App.Table.gsiPkType as ddb.AttributeType
    },
    sortKey: {
        name: App.Table.gsiSkName,
        type: App.Table.gsiSkType  as ddb.AttributeType
    }
})

const lambdaPermissions: IAM.Permissions = new IAM.Permissions(
    ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:Query"],
    "Allow",
    [table],
    [`${tableInstance.arn}/index/*`]
)
const lambda: Lambda.Function = new Lambda.Function(
    `${App.prefixId}-lambda`, "src", tags, "Lambda.handler", undefined, lambdaPermissions)
app.addResource(lambda)

const restApi: ApiGateway.RestApi.Lambda = ApiGateway.RestApi.Lambda.new(`${App.prefixId}-api-gw`, lambda, tags)
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



