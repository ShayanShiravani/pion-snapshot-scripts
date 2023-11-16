import { mkConfig, generateCsv, asString } from "export-to-csv";
import { writeFile } from "node:fs";
import { Buffer } from "node:buffer";
import ABI from '../abis/MuonNodeManager.json'  assert { type: "json" };
import Web3 from 'web3';
import 'dotenv/config';


const RPC_URL = `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`
const CONTRACT_ADDRESS = "0xD884634095AB3058264eE3143078F27D8fD78b9F"
const csvConfig = mkConfig({ useKeysAsHeaders: true, filename: "./migration/data/nodes" })
const deactivatedNodesCsvConfig = mkConfig(
  { useKeysAsHeaders: true, filename: "./migration/data/deactivatedNodes" }
)

const web3 = new Web3(RPC_URL)
const contract = new web3.eth.Contract(ABI.abi, CONTRACT_ADDRESS)

let deactivatedNodes = []

const getNodes = async () => {
  let response = []
  let toId = 0
  let lastNodeId = await contract.methods.lastNodeId().call()
  while(true) {
    console.log(toId)
    try {
      const nodes = await contract.methods.getAllNodes(
        '18280120',
        toId + 1,
        toId + 100
      ).call()
      const reducedResult = nodes.reduce((result, n) => {
        result.push({
          id: n.id,
          nodeAddress: n.nodeAddress,
          stakerAddress: n.stakerAddress,
          peerId: n.peerId,
          tier: n.tier
        })
        if(!n.active) {
          deactivatedNodes.push({
            id: n.id
          })
        }
        return result
      }, [])
      response = response.concat(reducedResult)
    } catch (error) {
      console.log(error.message)
    }
    if(toId + 100 < lastNodeId) {
      toId += 100
    } else {
      break
    }
  }
  return response
}

const main = async () => {
  let nodes = await getNodes()
  console.log("total nodes:", nodes.length)
  console.log("total deactivated nodes:", deactivatedNodes.length)
  

  const csv = generateCsv(csvConfig)(nodes)
  const filename = `${csvConfig.filename}.csv`
  const csvBuffer = new Uint8Array(Buffer.from(asString(csv)))
  writeFile(filename, csvBuffer, (err) => {
    if (err) throw err
    console.log("file saved: ", filename)
  })

  const csv2 = generateCsv(deactivatedNodesCsvConfig)(deactivatedNodes)
  const filename2 = `${deactivatedNodesCsvConfig.filename}.csv`
  const csvBuffer2 = new Uint8Array(Buffer.from(asString(csv2)))
  writeFile(filename2, csvBuffer2, (err) => {
    if (err) throw err
    console.log("file saved: ", filename2)
  })
}

main()