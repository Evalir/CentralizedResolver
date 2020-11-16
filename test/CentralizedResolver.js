const { expect } = require('chai')
const { solidity } = require('@nomiclabs/hardhat-waffle')

describe('CentralizedResolver', function() {
  let signers, owner, centralizedResolver
  const NO_TOKEN = `${'0x'.padEnd(42, '0')}`

  before(async () => {
    signers = await ethers.getSigners()
    owner = await signers[0].getAddress()
    servant = await signers[1].getAddress()
    servantSigner = signers[1]
  })

  beforeEach(async () => {
    const CentralizedResolverFactory = await ethers.getContractFactory(
      'CentralizedResolver'
    )
    centralizedResolver = await CentralizedResolverFactory.deploy(
      owner,
      NO_TOKEN,
      0n
    )
    await centralizedResolver.deployed()
  })

  // Happy paths

  it('Returns dispute fee information correctly', async () => {
    const [
      dictator,
      feeToken,
      feeAmount,
    ] = await centralizedResolver.getDisputeFees()
    expect(dictator).to.equal(dictator)
    expect(feeToken).to.equal(NO_TOKEN)
    expect(feeAmount).to.equal(0)
  })

  it('Returns the payment recipient correctly', async () => {
    const paymentRecipient = await centralizedResolver.getPaymentsRecipient()
    expect(paymentRecipient).to.equal(owner)
  })

  it('Creates the dispute correctly', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
  })

  it('Creates two disputes correctly', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.createDispute(2n, '0xcafe'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(1, owner, '0xcafe')
  })

  it('Creates a dispute correctly and retrieves information about it', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')

    const [
      subject,
      possibleRulings,
      finalRuling,
      disputeState,
    ] = await centralizedResolver.checkDispute(0n)

    expect(subject).to.equal(owner)
    expect(possibleRulings).to.equal(2)
    expect(finalRuling).to.equal(0)
    expect(disputeState).to.equal(0)
  })

  it('Creates a dispute and submits evidence correctly', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.submitEvidence(0n, owner, '0xdeadbeef'))
      .to.emit(centralizedResolver, 'EvidenceSubmitted')
      .withArgs(0, owner, '0xdeadbeef')
  })

  it('Creates a dispute correctly and closes the evidence period', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.closeEvidencePeriod(0n))
      .to.emit(centralizedResolver, 'EvidencePeriodClosed')
      .withArgs(0)
  })

  it('Creates a dispute correctly, closes the evidence period, and rules it as a dictator', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.closeEvidencePeriod(0n))
      .to.emit(centralizedResolver, 'EvidencePeriodClosed')
      .withArgs(0)
    await expect(centralizedResolver.dictate(0n, 4n))
      .to.emit(centralizedResolver, 'Dictated')
      .withArgs(0, 4)
  })

  it('Creates a dispute correctly, closes the evidence period, rules it, and finalizes it', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.closeEvidencePeriod(0n))
      .to.emit(centralizedResolver, 'EvidencePeriodClosed')
      .withArgs(0)
    await expect(centralizedResolver.dictate(0n, 4n))
      .to.emit(centralizedResolver, 'Dictated')
      .withArgs(0, 4)
    await expect(centralizedResolver.rule(0n))
      .to.emit(centralizedResolver, 'Ruled')
      .withArgs(0, 4)
  })

  it('Fails to create the dispute due to invalid amount of rulings', async () => {
    await expect(
      centralizedResolver.createDispute(4n, '0x')
    ).to.be.revertedWith('Disputes: Can only be binary')
  })

  it('Creates a dispute correctly and fails to submit evidence to subject not being owner', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(
      centralizedResolver
        .connect(servantSigner)
        .submitEvidence(0n, servant, '0xdeadbeef')
    ).to.be.revertedWith('Evidence: Only arbitrable can submit evidence')
  })

  it('Creates a dispute correctly, closes the evidence period and fails to submit evidence due to period being closed', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.closeEvidencePeriod(0n))
      .to.emit(centralizedResolver, 'EvidencePeriodClosed')
      .withArgs(0)
    await expect(
      centralizedResolver.submitEvidence(0n, owner, '0xdeadbeef')
    ).to.be.revertedWith('Evidence: Period closed')
  })

  it('Creates a dispute correctly, closes the evidence period and fails due to trying to close it again', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.closeEvidencePeriod(0n))
      .to.emit(centralizedResolver, 'EvidencePeriodClosed')
      .withArgs(0)
    await expect(
      centralizedResolver.closeEvidencePeriod(0n)
    ).to.be.revertedWith('Evidence: Period closed')
  })

  it('Creates a dispute correctly, and fails to dictate a ruling due to the evidence period not being closed', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.closeEvidencePeriod(0n))
      .to.emit(centralizedResolver, 'EvidencePeriodClosed')
      .withArgs(0)
    await expect(centralizedResolver.dictate(0n, 4n))
      .to.emit(centralizedResolver, 'Dictated')
      .withArgs(0, 4)
  })

  it('Creates a dispute correctly, dictates a ruling over it, and fails to do it again', async () => {
    await expect(centralizedResolver.createDispute(2n, '0x'))
      .to.emit(centralizedResolver, 'NewDispute')
      .withArgs(0, owner, '0x')
    await expect(centralizedResolver.closeEvidencePeriod(0n))
      .to.emit(centralizedResolver, 'EvidencePeriodClosed')
      .withArgs(0)
    await expect(centralizedResolver.dictate(0n, 4n))
      .to.emit(centralizedResolver, 'Dictated')
      .withArgs(0, 4)
    await expect(centralizedResolver.dictate(0n, 4n)).to.be.revertedWith(
      "Disputes: A dictator can only rule when in adjudication"
    )
  })
})
