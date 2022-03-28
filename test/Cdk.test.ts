import {app} from "../Application"

test("deploy application", async(done) => {
    await app.deploy("p2vtpm")
    done()
}, 1000000)

test("undeploy application", async(done) => {
    await app.undeploy("p2vtpm")
    done()
}, 1000000)
