import {app} from "../Application"
import {APIGatewayProxyEvent} from "aws-lambda"
import {handler} from "../src/Lambda"
import {User} from "../src/User"
import {Carpool} from "../src/Carpool"
import {Endpoint} from "../src/Endpoint"

test("deploy application", async(done) => {
    await app.deploy("p2vtpm")
    done()
}, 1000000)

test("undeploy application", async(done) => {
    await app.undeploy("p2vtpm")
    done()
}, 1000000)

const event: APIGatewayProxyEvent = {
    httpMethod: "",
    resource: "",
    body: JSON.stringify({}),
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    path: "",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
        accountId: "",
        apiId:"",
        authorizer: {},
        protocol: "",
        httpMethod: "",
        identity: {
            accessKey:  null,
            accountId: null,
            apiKey: null,
            apiKeyId: null,
            caller: null,
            clientCert: null,
            cognitoAuthenticationProvider: null,
            cognitoAuthenticationType: null,
            cognitoIdentityId: null,
            cognitoIdentityPoolId: null,
            principalOrgId: null,
            sourceIp: "",
            user: null,
            userAgent: null,
            userArn: null
        },
        path: "",
        stage: "",
        requestId: "",
        requestTimeEpoch: 0,
        resourceId: "",
        resourcePath: ""
    }
}

test("create user", async(done) => {
    const user: User.Attributes = {
        "name": "Claudi Paniagua",
        "longitude": 1234,
        "latitude": 546
    }
    event.resource = "/user"
    event.httpMethod = "POST"
    event.body = JSON.stringify(user)
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("get user", async(done) => {
    event.resource = "/user/{id}"
    event.httpMethod = "GET"
    event.pathParameters = {
        id: "27872385325"
    }
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("update user", async(done) => {
    const location: User.Location = {
        "longitude": 666,
        "latitude": 666
    }
    event.resource = "/user/{id}"
    event.httpMethod = "PUT"
    event.pathParameters = {
        id: "7626746724"
    }
    event.body = JSON.stringify(location)
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("create carpool", async(done) => {
    const carpool: Carpool.Attributes = {
        "host": "43534",
        "genre": "pop",
        "licensePlate": "GY3421"
    }
    event.resource = "/carpool"
    event.httpMethod = "POST"
    event.body = JSON.stringify(carpool)
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("get carpool", async(done) => {
    event.resource = "/carpool/{id}"
    event.httpMethod = "GET"
    event.pathParameters = {
        id: "672766455"
    }
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("add carpool participants", async(done) => {
    const participants: Carpool.Participants = {
        participants: ["672373472", "3672476234"]
    }
    event.resource = "/carpool/{id}/participants"
    event.httpMethod = "POST"
    event.pathParameters = {
        id: "763624367"
    }
    event.body = JSON.stringify(participants)
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})

test("get carpool participants", async(done) => {
    event.resource = "/carpool/{id}/participants"
    event.httpMethod = "GET"
    event.pathParameters = {
        id: "872347672"
    }
    const response: Endpoint.Response = await handler(event)
    console.log(JSON.stringify(response))
    done()
})
