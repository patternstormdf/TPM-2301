import {DynamoDB} from "@pstorm/aws-cdk"

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
            }
        }

        export namespace GSI {

            export namespace HostCarpool {
                export const name: string ="Host-Carpool"
                export const attributes: string[] = [Table.Attribute.Carpool.Status.name]

                export namespace Key {

                    export namespace Primary {
                        export const name: string = Table.Attribute.Carpool.Host.name
                        export const type: DynamoDB.Table.Key.Type = Table.Attribute.Carpool.Host.type as DynamoDB.Table.Key.Type
                    }

                    export namespace Sort {
                        export const name: string = Table.Key.Primary.name
                        export const type: DynamoDB.Table.Key.Type = Table.Key.Primary.type
                    }
                }
            }

            export namespace ParticipantCarpool {
                export const name: string = "Participant-Carpool"

                export const attributes: string[] = [Table.Attribute.Carpool.Status.name, Table.Attribute.User.IsWinner.name]

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
    }
}


export function isDefined<T>(argument: T | undefined | null): argument is T {
    return (argument !== undefined) && (argument !== null)
}
