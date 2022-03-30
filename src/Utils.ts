import {DynamoDB} from "@pstorm/aws-cdk"
import * as AWS from "aws-sdk"

export namespace Application {
    export const account: string = "162174280605"
    export const region: string = "us-east-1"
    export const prefixId: string = "cpaniagua-AWS-DynamoDB-Badge-Task-2-Access-Patterns"

    export namespace Table {
        export const name: string = `${prefixId}-db-table`

        export namespace Key {

            export namespace Primary {
                export const name: string = "PK"
                export const type: DynamoDB.Table.Key.Type = "S"
            }

            export namespace Sort {
                export const name: string = "SK"
                export const type: DynamoDB.Table.Key.Type = "S"
            }
        }

        export namespace Attribute {

            export namespace Carpool {

                export namespace Host {
                    export const name: string = "Host"
                    export const type: DynamoDB.Table.Attribute.Type = "S"
                }

                export namespace Genre {
                    export const name: string = "Genre"
                    export const type: DynamoDB.Table.Attribute.Type = "S"
                }

                export namespace Status {
                    export const name: string = "Status"
                    export const type: DynamoDB.Table.Attribute.Type = "S"
                    export const Available: string = "available"
                    export const Full: string = "full"
                    export const Started: string = "started"
                    export const Closed: string = "closed"
                }

                export namespace LicencePlate {
                    export const name: string = "LicencePlate"
                    export const type: DynamoDB.Table.Attribute.Type = "S"
                }

                export namespace Winner {
                    export const name: string = "Winner"
                    export const type: DynamoDB.Table.Attribute.Type = "S"
                }

                export namespace Participants {
                    export const name: string = "Participants"
                    export const type: DynamoDB.Table.Attribute.Type = "N"
                }
            }

            export namespace User {

                export namespace Longitude {
                    export const name: string = "Longitude"
                    export const type: DynamoDB.Table.Attribute.Type = "N"
                }

                export namespace Latitude {
                    export const name: string = "Latitude"
                    export const type: DynamoDB.Table.Attribute.Type = "N"
                }

                export namespace IsWinner {
                    export const name: string = "isWinner"
                    export const type: DynamoDB.Table.Attribute.Type = "BOOL"
                }

                export namespace IsHost {
                    export const name: string = "isHost"
                    export const type: DynamoDB.Table.Attribute.Type = "BOOL"
                }
            }
        }

        export namespace GSI {

            export namespace CarpoolUser {
                export const name: string = "Carpool-User"

                export const attributes: string[] = [
                    Table.Attribute.Carpool.Status.name,
                    Table.Attribute.User.IsWinner.name,
                    Table.Attribute.User.IsHost.name
                ]

                export namespace Key {

                    export namespace Primary {
                        export const name: string = Table.Key.Sort.name
                        export const type: DynamoDB.Table.Key.Type = Table.Key.Sort.type
                    }

                    export namespace Sort {
                        export const name: string = Table.Key.Primary.name
                        export const type: DynamoDB.Table.Key.Type = Table.Key.Primary.type
                    }
                }
            }

            export namespace StatusCarpool {
                export const name: string = "Status-Carpool"

                export const attributes: string[] = [
                    Table.Attribute.Carpool.Host.name,
                    Table.Attribute.Carpool.Genre.name,
                    Table.Attribute.Carpool.LicencePlate.name
                ]

                export namespace Key {

                    export namespace Primary {
                        export const name: string = Table.Attribute.Carpool.Status.name
                        export const type: DynamoDB.Table.Key.Type = Table.Attribute.Carpool.Status.type as DynamoDB.Table.Key.Type
                    }

                    export namespace Sort {
                        export const name: string = Table.Key.Primary.name
                        export const type: DynamoDB.Table.Key.Type = Table.Key.Primary.type
                    }
                }

            }

        }

        export namespace Lock {

            const ddb: AWS.DynamoDB = new AWS.DynamoDB({region: region})

            export class Exception extends Error {
                constructor(message: string) {
                    super(message)
                }
            }

            async function create(): Promise<void> {
                const input: AWS.DynamoDB.Types.PutItemInput = {
                    TableName: Table.name,
                    ConditionExpression: `attribute_not_exists(${Table.Key.Primary.name})`,
                    Item: {
                        [Table.Key.Primary.name]: {[Table.Key.Primary.type]: "Lock"},
                        [Table.Key.Sort.name]: {[Table.Key.Sort.type]: "Lock"}
                    }
                }
                await ddb.putItem(input).promise()
            }

            async function remove(): Promise<void> {
                const input: AWS.DynamoDB.Types.DeleteItemInput = {
                    TableName: Table.name,
                    Key: {
                        [Table.Key.Primary.name]: {[Table.Key.Primary.type]: "Lock"},
                        [Table.Key.Sort.name]: {[Table.Key.Sort.type]: "Lock"},
                    }
                }
                await ddb.deleteItem(input).promise()
            }

            export async function acquire(): Promise<void> {
                try {
                    await create()
                } catch (err: any) {
                    throw new Lock.Exception(`Could not acquire lock, error=${err.message}`)
                }
            }

            export async function release(): Promise<void> {
                try {
                    await remove()
                } catch (err: any) {
                    throw new Lock.Exception(`Could not release lock, error=${err.message}`)
                }
            }

            export async function dispatch<T>(operation: () => Promise<T>, retries: number = 0): Promise<T> {
                try {
                    await Lock.acquire()
                } catch (err: any) {
                    if (err instanceof Lock.Exception) {
                        if (retries == 15) throw new Lock.Exception("Exceeded mMax. number of retries to acquire the lock")
                        await delay(300)
                        return await dispatch(operation, retries + 1)
                    }
                    throw err
                }
                try {
                    return await operation()
                } finally {
                    await Lock.release()
                }
            }

        }
    }
}

export async function delay(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function isDefined<T>(argument: T | undefined | null): argument is T {
    return (argument !== undefined) && (argument !== null)
}
