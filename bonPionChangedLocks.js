import axios from 'axios';
import { mkConfig, generateCsv, asString } from "export-to-csv";
import { writeFile } from "node:fs";
import { Buffer } from "node:buffer";
import BN from 'bn.js';


const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/shayanshiravani/pion-test"
let tokenLockedAmounts = {}
const csvConfig = mkConfig({ useKeysAsHeaders: true, filename: "bonPion_changed_locks" })
const PION_ADDRESS = "0xf81df93ab37d5b1396139f294418b2741143b280"

const bn = (value) => new BN(value)

const getStakers = async () => {
  let response = {}
  let skip = 0
  while(true) {
    try {
      const query = `
        {
          muonNodeAddeds(
            first: 1000
            skip: ${skip}
            orderBy: blockNumber
            orderDirection: asc
          ) {
            stakerAddress
            tokenId
          }
        }
      `
      const {
        data: { data },
        status
      } = await axios.post(GRAPH_URL, {
        query: query
      })
      if (status == 200 && data) {
        const {
          muonNodeAddeds,
        } = data
        if(muonNodeAddeds.length) {
          console.log(muonNodeAddeds.length)
          response = {
            ...response, 
            ...muonNodeAddeds.reduce((result, a) => {
              result[a.tokenId] = a.stakerAddress
              return result
            }, {})
          }
          skip += 1000
        } else {
          break
        }
      } else {
        throw { message: 'INVALID_SUBGRAPH_RESPONSE' }
      }
    } catch (error) {
      console.log(error.message)
    }
  }
  return response
}

const getLocks = async () => {
  try {
    const query = `
      {
        lockeds(
          where: {
            and: [
              {
                tokens_contains: ["${PION_ADDRESS}"]
              },
              {blockNumber_gt: 18426798}
            ]
          }
          orderBy: blockNumber
          orderDirection: asc
        ) {
          tokenId
          tokens
          amounts
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
        lockeds
      } = data
      return lockeds
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



const main = async () => {
  const stakers = await getStakers()
  // console.log(stakers)
  console.log(Object.keys(stakers).length)
  let response = []
  const lockeds = await getLocks()

  lockeds.map((item) => {
    item.tokens.map((token, i) => {
      if(token.toLowerCase() == PION_ADDRESS) {
        if(!(item.tokenId in tokenLockedAmounts)) {
          tokenLockedAmounts[item.tokenId] = bn(0)
        }
        tokenLockedAmounts[item.tokenId] = tokenLockedAmounts[item.tokenId].add(
          bn(item.amounts[i])
        )
      }
    });
  })

  Object.keys(tokenLockedAmounts).map(tokenId => {
    response.push({
      staker: stakers[tokenId],
      tokenId: tokenId,
      lock_amount: tokenLockedAmounts[tokenId].toString()
    })
  })
  

  const csv = generateCsv(csvConfig)(response)
  const filename = `${csvConfig.filename}.csv`
  const csvBuffer = new Uint8Array(Buffer.from(asString(csv)))
  writeFile(filename, csvBuffer, (err) => {
    if (err) throw err
    console.log("file saved: ", filename)
  })
}

main()