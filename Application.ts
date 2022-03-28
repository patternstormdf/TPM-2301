import {Application, Lambda, ApiGateway, DynamoDB, IAM} from "@pstorm/aws-cdk"
import * as apigw from "aws-cdk-lib/aws-apigateway"
import {Application as App} from "./src/Utils"

const tags: Application.Resource.Tag[] = [
    {key: "owner", value : "claudi.paniagua@devfactory.com"},
    {key: "purpose", value: "https://devgraph-alp.atlassian.net/browse/TPM-2483"}
]

export const app = Application.new( `${App.prefixId}-app`, App.account, App.region,"Application.ts")

const gsiHostCarpool: DynamoDB.Table.GSI = {
    name: App.Table.GSI.HostCarpool.name,
    partitionKey: App.Table.GSI.HostCarpool.Key.Primary,
    sortKey: App.Table.GSI.HostCarpool.Key.Sort,
    projectedAttributes: App.Table.GSI.HostCarpool.attributes
}

const gsiParticipantCarpool: DynamoDB.Table.GSI = {
    name: App.Table.GSI.ParticipantCarpool.name,
    partitionKey: App.Table.GSI.ParticipantCarpool.Key.Primary,
    sortKey: App.Table.GSI.ParticipantCarpool.Key.Sort,
    projectedAttributes: App.Table.GSI.ParticipantCarpool.attributes
}

const gsiStatusCarpool: DynamoDB.Table.GSI = {
    name: App.Table.GSI.StatusCarpool.name,
    partitionKey: App.Table.GSI.StatusCarpool.Key.Primary,
    sortKey: App.Table.GSI.StatusCarpool.Key.Sort,
    projectedAttributes: App.Table.GSI.StatusCarpool.attributes
}

const table: DynamoDB.Table = DynamoDB.Table.new({
    name: App.Table.name,
    tags: tags,
    pkName: App.Table.Key.Primary.name,
    pkType: App.Table.Key.Primary.type,
    skName: App.Table.Key.Sort.name,
    skType: App.Table.Key.Sort.type,
    GSIs: [gsiHostCarpool, gsiParticipantCarpool, gsiStatusCarpool]
})
const tableInstance: DynamoDB.Table.Instance = app.addResource(table) as DynamoDB.Table.Instance

const lambdaPermissions: IAM.Permissions = new IAM.Permissions(
    ["dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:Query"],
    "Allow",
    [table],
    [`${tableInstance.arn}/index/*`]
)
const lambda: Lambda.Function = new Lambda.Function(
    `${App.prefixId}-lambda`, "src", tags, "Lambda.handler", undefined, lambdaPermissions)
app.addResource(lambda)

const restApi: ApiGateway.API.REST.Base = ApiGateway.API.REST.Lambda.new(`${App.prefixId}-api-gw`, lambda, tags)
const restApiInstance: ApiGateway.API.REST.Base.Instance = app.addResource(restApi) as ApiGateway.API.REST.Base.Instance
const restApiRoot: apigw.IResource = restApiInstance.asConstruct.root
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
const participantCarpools: apigw.IResource = carpool.addResource("participants").addResource("{id}")
participantCarpools.addMethod("GET")
const joinCarpool: apigw.IResource = carpoolId.addResource("join")
joinCarpool.addMethod("POST")
const startCarpool: apigw.IResource = carpoolId.addResource("start")
startCarpool.addMethod("POST")
const stopCarpool: apigw.IResource = carpoolId.addResource("end")
stopCarpool.addMethod("POST")
const availableCarpools: apigw.IResource = carpool.addResource("available")
availableCarpools.addMethod("GET")
const availableCarpoolsByGenre: apigw.IResource = availableCarpools.addResource("genre").addResource("{genre}")
availableCarpoolsByGenre.addMethod("GET")



