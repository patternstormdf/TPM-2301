import {APIGatewayProxyEvent} from "aws-lambda"
import {handler} from "../src/Lambda"
import {User} from "../src/User"
import {Carpool} from "../src/Carpool"
import {Endpoint} from "../src/Endpoint"
import {v4 as uuidv4} from "uuid"
import {Application as App} from "../src/Utils"

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

async function delay(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function createUser(user: User): Promise<User> {
    event.resource = "/user"
    event.httpMethod = "POST"
    event.body = JSON.stringify(user)
    const response: Endpoint.Response = await handler(event)
    return JSON.parse(response.body)
}

async function getUserById(userName: string): Promise<User> {
    event.resource = "/user/{id}"
    event.httpMethod = "GET"
    event.pathParameters = {
        id: userName
    }
    const response: Endpoint.Response = await handler(event)
    return JSON.parse(response.body)
}

async function updateUserLocation(userId: string, location: User.Location): Promise<User.Location | undefined> {
    event.resource = "/user/{id}"
    event.httpMethod = "PUT"
    event.pathParameters = {
        id: userId
    }
    event.body = JSON.stringify(location)
    const response: Endpoint.Response = await handler(event)
    return (response.statusCode == 200)? JSON.parse(response.body) : undefined
}

async function createCarpool(carpool: Carpool.Attributes): Promise<Carpool | undefined> {
    event.resource = "/carpool"
    event.httpMethod = "POST"
    event.body = JSON.stringify(carpool)
    const response: Endpoint.Response = await handler(event)
    if (response.statusCode != 200) return undefined
    return JSON.parse(response.body)
}

async function joinCarpool(carpoolId: string, userName: string): Promise<Carpool> {
    event.resource = "/carpool/{id}/join"
    event.httpMethod = "POST"
    event.pathParameters = {
        id: carpoolId
    }
    event.body = JSON.stringify({participant: userName})
    const response: Endpoint.Response = await handler(event)
    return JSON.parse(response.body)
}

async function startCarpool(carpoolId: string, userName: string): Promise<Endpoint.Response> {
    event.resource = "/carpool/{id}/start"
    event.httpMethod = "POST"
    event.pathParameters = {
        id: carpoolId
    }
    event.body = JSON.stringify({user: userName})
    return await handler(event)
}

async function closeCarpool(carpoolId: string, userName: string, winner: string): Promise<Endpoint.Response> {
    event.resource = "/carpool/{id}/end"
    event.httpMethod = "POST"
    event.pathParameters = {
        id: carpoolId
    }
    event.body = JSON.stringify({user: userName, winner: winner})
    return await handler(event)
}

async function getCarpoolById(carpoolId: string): Promise<Carpool> {
    event.resource = "/carpool/{id}"
    event.httpMethod = "GET"
    event.pathParameters = {
        id: carpoolId
    }
    const response: Endpoint.Response = await handler(event)
    return JSON.parse(response.body)
}

async function getCarpoolParticipants(carpoolId: string): Promise<Carpool.Participants> {
    event.resource = "/carpool/{id}/participants"
    event.httpMethod = "GET"
    event.pathParameters = {
        id: carpoolId
    }
    const response: Endpoint.Response = await handler(event)
    return JSON.parse(response.body)
}

namespace Factory {
    enum Genre {
        "Pop",
        "Rock",
        "Techno",
        "Punk",
        "Opera"
    }

    enum Letter {
        "P",
        "K",
        "L",
        "Z",
        "M"
    }

    function random(min: number, max: number): number {
        return Math.floor(Math.random() * ((max + 1) - min) + min)
    }
    export function newUserName(): string { return uuidv4()}
    export function newLatitude(): number { return random(1000,9999) }
    export function newLongitude(): number { return random(1000,9999) }
    export function newGenre(): string {
        const n: number = random(0,4)
        return Genre[n]
    }
    export function newLicensePlate(): string {
        const n: number = random(0,4)
        const m: number = random(0,4)
        return `${Letter[n]}${Letter[m]}${random(1000,9999)}`
    }
}

test("the lock can be acquired after being released", async(done) => {
    await App.Table.Lock.acquire()
    await App.Table.Lock.release()
    await App.Table.Lock.acquire()
    await App.Table.Lock.release()
    done()
}, 80000)

test("the lock cannot be acquired without first being released", async(done) => {
    await App.Table.Lock.acquire()
    try {
        await App.Table.Lock.acquire()
        fail()
    } catch (err: any) {
        if (!(err instanceof App.Table.Lock.Exception)) fail()
    } finally {
        await App.Table.Lock.release()
    }
    done()
}, 80000)

test("join carpool fails if lock is acquired", async(done) => {
    //TODO
    done()
}, 80000)

test("start carpool fails if lock is acquired", async(done) => {
    //TODO
    done()
}, 80000)

test("close carpool fails if lock is acquired", async(done) => {
    //TODO
    done()
}, 80000)

test("create user", async(done) => {
    const expectedUser: User = {
        "name": Factory.newUserName(),
        "longitude": Factory.newLongitude(),
        "latitude": Factory.newLatitude()
    }
    const user: User = await createUser(expectedUser)
    console.log(JSON.stringify(user))
    expect(user.name).toBe(expectedUser.name)
    expect(user.longitude).toBe(expectedUser.longitude)
    expect(user.latitude).toBe(expectedUser.latitude)
    done()
})

test("get user", async(done) => {
    const expectedUser: User = {
        "name": Factory.newUserName(),
        "longitude": Factory.newLongitude(),
        "latitude": Factory.newLatitude()
    }
    await createUser(expectedUser)
    const user: User = await getUserById(expectedUser.name)
    expect(user.name).toBe(expectedUser.name)
    expect(user.longitude).toBe(expectedUser.longitude)
    expect(user.latitude).toBe(expectedUser.latitude)
    done()
})

test("update user location of existing user", async(done) => {
    const expectedUser: User = {
        "name": Factory.newUserName(),
        "longitude": Factory.newLongitude(),
        "latitude": Factory.newLatitude()
    }
    await createUser(expectedUser)
    const expectedLocation: User.Location = {
        "longitude": 6666,
        "latitude": 7777
    }
    await updateUserLocation(expectedUser.name, expectedLocation)
    const user: User = await getUserById(expectedUser.name)
    expect(user.name).toBe(expectedUser.name)
    expect(user.longitude).toBe(expectedLocation.longitude)
    expect(user.latitude).toBe(expectedLocation.latitude)
    done()
})

test("update user location of non existing user", async(done) => {
    const newLocation: User.Location = {
        "longitude": 666,
        "latitude": 777
    }
    const location: User.Location | undefined = await updateUserLocation("doesnotexist", newLocation)
    expect(location).toBe(undefined)
    done()
})

test("create carpool", async(done) => {
    const carpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const expectedCarpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    const carpool: Carpool = await getCarpoolById(expectedCarpool.id)
    console.log(JSON.stringify(carpool))
    expect(carpool.id).toBe(expectedCarpool.id)
    expect(carpool.host).toBe(expectedCarpool.host)
    expect(carpool.genre).toBe(expectedCarpool.genre)
    expect(carpool.licencePlate).toBe(expectedCarpool.licencePlate)
    done()
})

test("create carpool fails if lock is acquired", async(done) => {
    await App.Table.Lock.acquire()
    const carpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    try {
        const carpool: Carpool | undefined = await createCarpool(carpoolAttrs)
        expect(carpool).toBe(undefined)
    } finally {
        await App.Table.Lock.release()
    }
    done()
}, 80000)

test("get carpool by id", async(done) => {
    const carpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const expectedCarpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    const carpool: Carpool = await getCarpoolById(expectedCarpool.id)
    expect(carpool.id).toBe(expectedCarpool.id)
    expect(carpool.host).toBe(expectedCarpool.host)
    expect(carpool.genre).toBe(expectedCarpool.genre)
    expect(carpool.licencePlate).toBe(expectedCarpool.licencePlate)
    done()
})

test("a participant of an available carpool cannot create a carpool", async(done) => {
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userName: string = Factory.newUserName()
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await joinCarpool(existingCarpool.id, userName)
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": userName,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).toBe(undefined)
    done()
}, 80000)

test("when four participants join a carpool it becomes full", async(done) => {
    const carpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    const retrievedCarpool: Carpool = await getCarpoolById(carpool.id) as Carpool
    const participants: Carpool.Participants = await getCarpoolParticipants(carpool.id)
    expect(participants.participants.length).toBe(4)
    expect(retrievedCarpool.status).toBe("full")
    done()
}, 80000)

test("a fifth participant cannot join a carpool", async(done) => {
    const carpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName(), Factory.newUserName()
    ]
    const carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    const participants: Carpool.Participants = await getCarpoolParticipants(carpool.id)
    expect(participants.participants.length).toBe(4)
    done()
}, 80000)

test("a participant of a full carpool cannot create a carpool", async(done) => {
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
        ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("full")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": userNames[0],
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).toBe(undefined)
    done()
}, 80000)

test("a participant of an started carpool cannot create a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("full")
    expect(carpool.host).toBe(carpoolHost)
    await startCarpool(carpool.id, carpoolHost)
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("started")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": userNames[2],
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).toBe(undefined)
    done()
}, 80000)

test("a participant of a closed carpool can create a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    await startCarpool(carpool.id, carpoolHost)
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("started")
    await closeCarpool(carpool.id, carpoolHost, userNames[3])
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("closed")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": userNames[0],
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).not.toBe(undefined)
    done()
}, 80000)

test("a started carpool cannot be started", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    await startCarpool(carpool.id, carpoolHost)
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("started")
    const response: Endpoint.Response = await startCarpool(carpool.id, carpoolHost)
    expect(response.statusCode).toBe(400)
    done()
}, 80000)

test("a carpool with less than 4 participants cannot be started", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName()
    ]
    const carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    const updatedExistingCarpool: Carpool = await getCarpoolById(carpool.id)
    expect(updatedExistingCarpool.status).toBe("available")
    //TODO
    done()
}, 80000)

test("a closed carpool cannot be started", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    await closeCarpool(existingCarpool.id, existingCarpoolHost, userNames[3])
    let updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("closed")
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    updatedExistingCarpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("closed")
    done()
}, 80000)

test("a carpool with four participants can be started by the host", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("started")
    done()
}, 80000)

test("a carpool with four participants cannot be started by other user than the host", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, userNames[2])
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("full")
    done()
}, 80000)

test("a closed carpool cannot be closed", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    await startCarpool(carpool.id, carpoolHost)
    await closeCarpool(carpool.id, carpoolHost, userNames[3])
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("closed")
    const response: Endpoint.Response = await closeCarpool(carpool.id, carpoolHost, userNames[0])
    console.log(JSON.stringify(response))
    expect(response.statusCode).toBe(400)
    done()
}, 80000)

test("a carpool with less than 4 participants cannot be closed", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await closeCarpool(existingCarpool.id, existingCarpoolHost, userNames[0])
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("available")
    done()
}, 80000)

test("a full carpool cannot be closed", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    let updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("full")
    await closeCarpool(existingCarpool.id, existingCarpoolHost, userNames[1])
    updatedExistingCarpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("full")
    done()
}, 80000)

test("a started carpool can be closed by the host", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    let updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("started")
    await closeCarpool(existingCarpool.id, existingCarpoolHost, userNames[3])
    updatedExistingCarpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("closed")
    done()
}, 80000)

test("a started carpool cannot be closed by other user than the host", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    let updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("started")
    await closeCarpool(existingCarpool.id, userNames[1], userNames[3])
    updatedExistingCarpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("started")
    done()
}, 80000)

test("a host of an available carpool cannot create a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("available")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).toBe(undefined)
    done()
}, 10000)

test("a host of a full carpool cannot create a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("full")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    await delay(3000)
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).toBe(undefined)
    done()
}, 80000)

test("a host of an started carpool cannot create a carpool", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("started")
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).toBe(undefined)
    done()
}, 80000)

test("a host of a closed carpool can create a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    await startCarpool(carpool.id, carpoolHost)
    await closeCarpool(carpool.id, carpoolHost, userNames[3])
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("closed")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs)
    expect(newCarpool).not.toBe(undefined)
    done()
}, 80000)

test("a host of an available carpool cannot join a carpool", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("available")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: undefined | Carpool = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, existingCarpoolHost)
    const participants: Carpool.Participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(0)
    done()
}, 10000)

test("a host of a full carpool cannot join a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("full")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, carpoolHost)
    const participants: Carpool.Participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(0)
    done()
}, 80000)

test("a host of an started carpool cannot join a carpool", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("started")
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, existingCarpoolHost)
    const participants: Carpool.Participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(0)
    done()
}, 80000)

test("a host of a closed carpool can join a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    await startCarpool(carpool.id, carpoolHost)
    await closeCarpool(carpool.id, carpoolHost, userNames[3])
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("closed")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, carpoolHost)
    const participants: Carpool.Participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(1)
    done()
}, 80000)

test("a participant of an available carpool cannot join a carpool", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const participant: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await joinCarpool(existingCarpool.id, participant)
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("available")
    let participants: Carpool.Participants = await getCarpoolParticipants(existingCarpool.id)
    expect(participants.participants.length).toBe(1)
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: undefined | Carpool = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, participant)
    participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(0)
    done()
}, 10000)

test("a participant of a full carpool cannot join a carpool", async(done) => {
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("full")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, userNames[2])
    const participants: Carpool.Participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(0)
    done()
}, 80000)

test("a participant of an started carpool cannot join a carpool", async(done) => {
    const existingCarpoolHost: string = Factory.newUserName()
    const existingCarpoolAttrs: Carpool.Attributes = {
        "host": existingCarpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    const existingCarpool: Carpool = await createCarpool(existingCarpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(existingCarpool.id, userName)))
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    await startCarpool(existingCarpool.id, existingCarpoolHost)
    const updatedExistingCarpool: Carpool = await getCarpoolById(existingCarpool.id)
    expect(updatedExistingCarpool.status).toBe("started")
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, userNames[0])
    const participants: Carpool.Participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(0)
    done()
}, 80000)

test("a participant of a closed carpool can join a carpool", async(done) => {
    const carpoolHost: string = Factory.newUserName()
    const carpoolAttrs: Carpool.Attributes = {
        "host": carpoolHost,
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const userNames: string[] = [
        Factory.newUserName(), Factory.newUserName(),
        Factory.newUserName(), Factory.newUserName()
    ]
    let carpool: Carpool = await createCarpool(carpoolAttrs) as Carpool
    await Promise.all(userNames.map(async userName => await joinCarpool(carpool.id, userName)))
    await startCarpool(carpool.id, carpoolHost)
    await closeCarpool(carpool.id, carpoolHost, userNames[3])
    carpool = await getCarpoolById(carpool.id)
    expect(carpool.status).toBe("closed")
    const newCarpoolAttrs: Carpool.Attributes = {
        "host": Factory.newUserName(),
        "genre": Factory.newGenre(),
        "licencePlate": Factory.newLicensePlate()
    }
    const newCarpool: Carpool | undefined = await createCarpool(newCarpoolAttrs) as Carpool
    await joinCarpool(newCarpool.id, userNames[2])
    const participants: Carpool.Participants = await getCarpoolParticipants(newCarpool.id)
    expect(participants.participants.length).toBe(1)
    done()
}, 80000)

test("get carpool participants", async(done) => {
    //TODO
    //const response: Endpoint.Response = await getCarpoolParticipants("b55d9810-1c84-456f-8145-1935f3280e88")
    //console.log(JSON.stringify(response))
    done()
})
