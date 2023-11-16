import axios from 'axios';
import { mkConfig, generateCsv, asString } from "export-to-csv";
import { writeFile } from "node:fs";
import { Buffer } from "node:buffer";
import ABI from '../abis/MuonNodeStaking.json'  assert { type: "json" };
import Web3 from 'web3';
import 'dotenv/config';

const GRAPH_URL = "https://api.thegraph.com/subgraphs/name/shayanshiravani/pion-test"
const RPC_URL = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`
const CONTRACT_ADDRESS = "0x349a34804F8740c3202baDdeC0216c66A40c02e5"
const csvConfig = mkConfig({ useKeysAsHeaders: true, filename: "./migration/data/stakes" })

const web3 = new Web3(RPC_URL)
const contract = new web3.eth.Contract(ABI.abi, CONTRACT_ADDRESS)

const getStakers = async () => {
  let response = []
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
            nodeAddress
            peerId
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
          response = response.concat(muonNodeAddeds)
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

const getUserInfo = async (stakerAddress) => {
  try {
    const user = await contract.methods.users(
      stakerAddress
    ).call()
    return user
  } catch (error) {
    console.log(`Unable to get user ${stakerAddress}`)
  }
  return null
}



const main = async () => {
  let stakers = await getStakers()
  console.log("total stakes:", stakers.length)

  await Promise.all(stakers.map(async (s, i) => {
    let info = await getUserInfo(s.stakerAddress)
    if(!info) {
      info = await getUserInfo(s.stakerAddress)
    }
    if(!info) {
      throw "Please retry again"
    }
    const { 
      balance,
      paidReward,
      paidRewardPerToken,
      pendingRewards,
      tokenId
    } = info
    const {
      stakerAddress,
      nodeAddress,
      peerId
    } = s
    stakers[i] = {
      stakerAddress,
      balance,
      paidReward,
      paidRewardPerToken,
      pendingRewards,
      tokenId,
      nodeAddress,
      peerId
    }
    return true
  }))
  

  const csv = generateCsv(csvConfig)(stakers)
  const filename = `${csvConfig.filename}.csv`
  const csvBuffer = new Uint8Array(Buffer.from(asString(csv)))
  writeFile(filename, csvBuffer, (err) => {
    if (err) throw err
    console.log("file saved: ", filename)
  })
}

main()