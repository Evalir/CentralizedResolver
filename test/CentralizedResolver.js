const { expect } = require("chai")
const { solidity } = require("@nomiclabs/hardhat-waffle")

describe("CentralizedResolver", function() {
  let signers, owner, centralizedResolver
  const NO_TOKEN = `${"0x".padEnd(42, "0")}`

  before(async () => {
    signers = await ethers.getSigners()
    owner = await signers[0].getAddress()
  })

  beforeEach(async () => {
    const CentralizedResolverFactory = await ethers.getContractFactory(
      "CentralizedResolver",
    )
    centralizedResolver = await CentralizedResolverFactory.deploy(
      owner,
      NO_TOKEN,
      0n,
    )
    await centralizedResolver.deployed()
  })

  // Happy paths

  it("Returns dispute fee information correctly", async () => {
    const [
      dictator,
      feeToken,
      feeAmount,
    ] = await centralizedResolver.getDisputeFees()
    expect(dictator).to.equal(dictator)
    expect(feeToken).to.equal(NO_TOKEN)
    expect(feeAmount).to.equal(0)
  })

  it("Returns the payment recipient correctly", async () => {
    const paymentRecipient = await centralizedResolver.getPaymentsRecipient()
    expect(paymentRecipient).to.equal(owner)
  })

  it("Creates the dispute correctly", async () => {
    expect(centralizedResolver.createDispute(2n, "0x"))
      .to.emit(centralizedResolver, "NewDispute")
      .withArgs(1, owner, "0x")
  })

  it("Fails to create the dispute due to invalid amount of rulings", async () => {
    // TODO: Fix EVM exception—this is actually not working well!
    expect(centralizedResolver.createDispute(4n, "0x")).to.be.revertedWith(
      "Disputes: Too many options",
    )
  })
})
