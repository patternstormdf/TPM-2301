import {DynamoDB} from "@pstorm/aws-cdk"

export namespace Application {
    export const account: string = "162174280605"
    export const region: string = "us-east-1"
    export const prefixId: string = "cpaniagua-AWS-DynamoDB-Badge-Task-1-CRUD-Application"

    export namespace Table {
        export const name: string = `${prefixId}-db-table`
        export const pkName: string = "PK"
        export const pkType: DynamoDB.Table.AttributeType = "S"
        export const gsiPkName: string = "Carpool"
        export const gsiPkType: DynamoDB.Table.AttributeType = "S"
        export const gsiSkName: string = "Participant"
        export const gsiSkType: DynamoDB.Table.AttributeType = "S"
        export const gsiName: string = "Carpool-Participant"
    }
}


export function isDefined<T>(argument: T | undefined | null): argument is T {
    return (argument !== undefined) && (argument !== null)
}
