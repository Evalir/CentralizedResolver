//SPDX-License-Identifier: Unlicense
pragma solidity ^0.6.8;

import "hardhat/console.sol";
import "./lib/IArbitrator.sol";
import "./lib/IERC20.sol";

contract CentralizedResolver is IArbitrator {
    string private constant ERROR_EVIDENCE_PERIOD_CLOSED = "Evidence: Period closed";
    string private constant ERROR_NOT_ADJUDICATING = "Disputes: A dictator can only rule when in adjudication";
    string private constant ERROR_NOT_RULED = "Disputes: This dispute hasn't been ruled or is already closed.";
    string private constant ERROR_NOT_SUBJECT = "Evidence: Only arbitrable can submit evidence";
    string private constant ERROR_INVALID_RULING_OPTIONS = "Disputes: Can only be binary";

    uint8 internal constant MIN_RULING_OPTIONS = 2;
    uint8 internal constant MAX_RULING_OPTIONS = MIN_RULING_OPTIONS;

    enum DisputeState {
      PreEvidence,
      Adjudicating,
      Severing,
      Ruled
    }

    struct DictatorConfig {
      IERC20 feeToken;
      uint256 feeAmount;
    }

    struct Dispute {
      address subject;
      uint8 possibleRulings;
      uint8 finalRuling;
      DisputeState state;
    }

    // Address of the dictator A.K.A only resolver of these disputes
    address dictator;
    // Current CentralizedResolver configuration
    DictatorConfig dictatorConfig;
    // List of all disputes created in the Centralized Resolver
    Dispute[] internal disputes;

    modifier onlyDictator {
      require(msg.sender == dictator);
      _;
    }

    event NewDispute(uint256 indexed disputeId, address indexed subject, bytes metadata);
    event EvidencePeriodClosed(uint256 indexed disputeId);
    event EvidenceSubmitted(uint256 disputeId, address indexed submitter, bytes evidence);
    event Dictated(uint256 indexed disputeId, uint8 finalRuling);
    event Ruled(uint256 indexed disputeId, uint8 finalRuling);


    constructor(address _dictator, IERC20 _feeToken, uint256 _feeAmount) public {
      console.log("Deploying CentralizedResolver with dictator: ", _dictator);
      dictator = _dictator;
      dictatorConfig.feeToken = _feeToken;
      dictatorConfig.feeAmount = _feeAmount;
    }

    // External functions

    /**
    * @notice Dictate a ruling over the selected dispute, if possible
    * @param _disputeId id of the dispute to dictate on
    * @param _finalRuling Desired ruling
    */
    function dictate(uint256 _disputeId, uint8 _finalRuling) external onlyDictator {
      Dispute storage dispute = disputes[_disputeId];
      require(dispute.state == DisputeState.Adjudicating, ERROR_NOT_ADJUDICATING);
      dispute.finalRuling = _finalRuling;
      // Transitions into the Severing state, to avoid ruling a dispute more than once.
      // A ruling is then finalized once the arbitrable calls rule()
      dispute.state = DisputeState.Severing;
      console.log("Dictated dispute %s with ruling %s", _disputeId, _finalRuling);
      emit Dictated(_disputeId, _finalRuling);
    }

    /**
    * @notice Check dispute stored with _disputeId
    * @param _disputeId id of the dispute to check
    * @return Dispute state
    */
    function checkDispute(uint256 _disputeId) external view returns (address, uint8, uint8, DisputeState) {
      Dispute storage dispute = disputes[_disputeId];

      return (dispute.subject, dispute.possibleRulings, dispute.finalRuling, dispute.state);
    }


    // IArbitrator functions

    /**
    * @dev Create a dispute over the Arbitrable sender with a number of possible rulings
    * @param _possibleRulings Number of possible rulings allowed for the dispute
    * @param _metadata Optional metadata that can be used to provide additional information on the dispute to be created
    * @return Dispute identification number
    */
    function createDispute(uint256 _possibleRulings, bytes calldata _metadata) override external returns (uint256) {
      require(_possibleRulings >= MIN_RULING_OPTIONS && _possibleRulings <= MAX_RULING_OPTIONS, ERROR_INVALID_RULING_OPTIONS);
      // Create dispute
      Dispute memory dispute = Dispute(
        msg.sender,
        uint8(_possibleRulings),
        0,
        DisputeState.PreEvidence
      );
      uint256 disputeId = disputes.length;
      disputes.push(dispute);
      console.log("Created new dispute", disputeId);
      emit NewDispute(disputeId, msg.sender, _metadata);

      return disputeId;
    }

    /**
    * @dev Submit evidence for a dispute
    * @param _disputeId Id of the dispute in the Protocol
    * @param _submitter Address of the account submitting the evidence
    * @param _evidence Data submitted for the evidence related to the dispute
    */
    function submitEvidence(uint256 _disputeId, address _submitter, bytes calldata _evidence) override external {
      Dispute storage dispute = disputes[_disputeId];
      require(dispute.subject == msg.sender, ERROR_NOT_SUBJECT);
      require(dispute.state == DisputeState.PreEvidence, ERROR_EVIDENCE_PERIOD_CLOSED);
      emit EvidenceSubmitted(_disputeId, _submitter, _evidence);
    }


    /**
    * @dev Close the evidence period of a dispute
    * @param _disputeId Identification number of the dispute to close its evidence submitting period
    */
    function closeEvidencePeriod(uint256 _disputeId) override external {
      Dispute storage dispute = disputes[_disputeId];
      require(dispute.state == DisputeState.PreEvidence, ERROR_EVIDENCE_PERIOD_CLOSED);
      dispute.state = DisputeState.Adjudicating;

      emit EvidencePeriodClosed(_disputeId);
    }

    /**
    * @notice Close ruling of dispute #`_disputeId` if a final ruling has been given.
    * @param _disputeId Identification number of the dispute to be ruled
    * @return subject Subject associated to the dispute
    * @return ruling Ruling number computed for the given dispute
    */
    function rule(uint256 _disputeId) override external returns (address subject, uint256 ruling) {
      Dispute storage dispute = disputes[_disputeId];
      require(msg.sender == dispute.subject, ERROR_NOT_SUBJECT);
      require(dispute.state == DisputeState.Severing, ERROR_NOT_RULED);
      // Transition into ruled state, effectively locking the dispute.
      dispute.state = DisputeState.Ruled;
      console.log("Closed dispute %s with ruling %s", _disputeId, dispute.finalRuling);
      emit Ruled(_disputeId, dispute.finalRuling);

      return (dispute.subject, dispute.finalRuling);
    }

    /**
    * @dev Tell the dispute fees information to create a dispute
    * @return recipient Address where the corresponding dispute fees must be transferred to
    * @return feeToken ERC20 token used for the fees
    * @return feeAmount Total amount of fees that must be allowed to the recipient
    */
    function getDisputeFees() override external view returns (address recipient, IERC20 feeToken, uint256 feeAmount) {
      return (address(dictator), dictatorConfig.feeToken, dictatorConfig.feeAmount);
    }

    /**
    * @dev Tell the payments recipient address
    * @return Address of the payments recipient module
    */
    function getPaymentsRecipient() override external view returns (address) {
      return address(dictator);
    }
}
