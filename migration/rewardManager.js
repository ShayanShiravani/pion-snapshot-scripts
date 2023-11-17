import axios from 'axios';
import { mkConfig, generateCsv, asString } from "export-to-csv";
import { writeFile } from "node:fs";
import { Buffer } from "node:buffer";


const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/shayanshiravani/pion-test"
const csvConfig = mkConfig({ useKeysAsHeaders: true, filename: "./migration/data/rewards" })

const getRewards = async () => {
  let response = []
  let skip = 0
  while(true) {
    try {
      const query = `
        {
          rewardClaimeds(
            first: 1000
            skip: ${skip}
            orderBy: blockNumber
            orderDirection: asc
          ) {
            claimer
            rewardAmount
            tokenId
          }
        }
      `
      const graphResponse = await axios.post(GRAPH_URL, {
        query: query
      })
      const {
        data: { data },
        status
      } = graphResponse
      if (status == 200 && data) {
        const {
          rewardClaimeds
        } = data
        if(rewardClaimeds.length) {
          response = response.concat(rewardClaimeds)
          skip += 1000
        } else {
          break
        }
      } else {
        const {
          data: { errors }
        } = graphResponse
        console.log(errors)
        throw { message: 'INVALID_SUBGRAPH_RESPONSE' }
      }
    } catch (error) {
      console.log(`An error accourd in fetching lockes`)
      console.log(error.message)
    }
  }
  return response
}



const main = async () => {
  let rewards = await getRewards()
  console.log(rewards.length)
  

  const csv = generateCsv(csvConfig)(rewards)
  const filename = `${csvConfig.filename}.csv`
  const csvBuffer = new Uint8Array(Buffer.from(asString(csv)))
  writeFile(filename, csvBuffer, (err) => {
    if (err) throw err
    console.log("file saved: ", filename)
  })
}

main()