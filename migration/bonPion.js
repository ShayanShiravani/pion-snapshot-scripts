import axios from 'axios';
import { mkConfig, generateCsv, asString } from "export-to-csv";
import { writeFile } from "node:fs";
import { Buffer } from "node:buffer";


const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/shayanshiravani/pion-test"
const csvConfig = mkConfig({ useKeysAsHeaders: true, filename: "./migration/data/bonPIONs" })

const getBonPIONs = async () => {
  let response = []
  let skip = 0
  while(true) {
    try {
      const query = `
        {
          bondedPIONs(
            first: 1000
            skip: ${skip}
            where:{
              owner_not: "0x0000000000000000000000000000000000000000"
            }
            orderBy: tokenId
            orderDirection: asc
          ) {
            tokenId
            owner
            pionBalance
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
          bondedPIONs
        } = data
        if(bondedPIONs.length) {
          response = response.concat(bondedPIONs)
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
  let bonPIONs = await getBonPIONs()
  console.log(bonPIONs.length)

  bonPIONs = bonPIONs.map((token) => ({
    ...token,
    mintedAt: '1700027573'
  }))
  

  const csv = generateCsv(csvConfig)(bonPIONs)
  const filename = `${csvConfig.filename}.csv`
  const csvBuffer = new Uint8Array(Buffer.from(asString(csv)))
  writeFile(filename, csvBuffer, (err) => {
    if (err) throw err
    console.log("file saved: ", filename)
  })
}

main()