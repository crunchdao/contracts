// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract CrunchMultiVesting is Ownable {
    event TokensReleased(
        address indexed beneficiary,
        uint256 index,
        uint256 amount
    );

    event CrunchTokenUpdated(
        address indexed previousCrunchToken,
        address indexed newCrunchToken
    );

    event CreatorChanged(
        address indexed previousAddress,
        address indexed newAddress
    );

    event VestingCreated(
        address indexed beneficiary,
        uint256 amount,
        uint256 start,
        uint256 cliff,
        uint256 duration,
        uint256 index
    );

    struct Vesting {
        /* beneficiary of tokens after they are released. */
        address beneficiary;
        /** the amount of token to vest. */
        uint256 amount;
        /** the start time of the token vesting. */
        uint256 start;
        /** the cliff time of the token vesting. */
        uint256 cliff;
        /** the duration of the token vesting. */
        uint256 duration;
        /** the amount of the token released. */
        uint256 released;
    }

    /* CRUNCH erc20 address. */
    IERC20Metadata public crunch;

    address public creator;
    uint256 public lockedReserve;
    mapping(address => Vesting[]) public vestings;

    mapping(address => uint256[]) _actives;

    constructor(address _crunch) {
        _setCrunch(_crunch);
        _setCreator(owner());
    }

    function name() external pure returns (string memory) {
        return "Vested CRUNCH Token";
    }

    function symbol() external pure returns (string memory) {
        return "vCRUNCH";
    }

    function decimals() external view returns (uint8) {
        return crunch.decimals();
    }

    function create(
        address beneficiary,
        uint256 amount,
        uint256 cliffDuration,
        uint256 duration
    ) external onlyCreatorOrOwner {
        require(
            beneficiary != address(0),
            "MultiVesting: beneficiary is the zero address"
        );

        require(amount > 0, "MultiVesting: amount is 0");

        require(duration > 0, "MultiVesting: duration is 0");

        require(
            cliffDuration <= duration,
            "MultiVesting: cliff is longer than duration"
        );

        require(
            availableReserve() >= amount,
            "MultiVesting: available reserve is not enough"
        );

        uint256 start = block.timestamp;
        uint256 cliff = start + cliffDuration;

        vestings[beneficiary].push(
            Vesting({
                beneficiary: beneficiary,
                amount: amount,
                start: start,
                cliff: cliff,
                duration: duration,
                released: 0
            })
        );

        uint256 index = vestings[beneficiary].length - 1;
        _actives[beneficiary].push(index);

        lockedReserve += amount;

        emit VestingCreated(beneficiary, amount, start, cliff, duration, index);
    }

    function reserve() public view returns (uint256) {
        return crunch.balanceOf(address(this));
    }

    function availableReserve() public view returns (uint256) {
        return reserve() - lockedReserve;
    }

    function release(uint256 index) external {
        _release(_msgSender(), index);
    }

    function releaseFor(address addr, uint256 index) external onlyOwner {
        _release(addr, index);
    }

    function releaseAll() external {
        _releaseAll(_msgSender());
    }

    function releaseAllFor(address addr) external onlyOwner {
        _releaseAll(addr);
    }

    function releasableAmount(address addr)
        external
        view
        returns (uint256 total)
    {
        uint256[] storage actives = _actives[addr];

        for (
            uint256 activeIndex = 0;
            activeIndex < actives.length;
            activeIndex++
        ) {
            uint256 index = actives[activeIndex];
            Vesting storage vesting = _getVesting(addr, index);

            total += _releasableAmount(vesting);
        }
    }

    function releasableAmountAt(address addr, uint256 index)
        external
        view
        returns (uint256)
    {
        Vesting storage vesting = _getVesting(addr, index);

        return _releasableAmount(vesting);
    }

    function vestedAmount(address addr) external view returns (uint256 total) {
        uint256 size = vestingsCount(addr);

        for (uint256 index = 0; index < size; index++) {
            Vesting storage vesting = _getVesting(addr, index);

            total += _vestedAmount(vesting);
        }
    }

    function vestedAmountAt(address addr, uint256 index)
        external
        view
        returns (uint256)
    {
        Vesting storage vesting = _getVesting(addr, index);

        return _vestedAmount(vesting);
    }

    function balanceOf(address addr) external view returns (uint256 balance) {
        uint256 size = vestingsCount(addr);

        for (uint256 index = 0; index < size; index++) {
            Vesting memory vesting = _getVesting(addr, index);

            balance += _releasableAmount(vesting);
        }
    }

    function setCrunch(address newCrunch) external onlyOwner {
        _setCrunch(newCrunch);
    }

    function setCreator(address newCreator) external onlyOwner {
        _setCreator(newCreator);
    }

    function vestingsCount(address beneficiary) public view returns (uint256) {
        return vestings[beneficiary].length;
    }

    function activeVestingsCount(address beneficiary)
        public
        view
        returns (uint256)
    {
        return _actives[beneficiary].length;
    }

    function activeVestingsIndex(address beneficiary)
        external
        view
        returns (uint256[] memory)
    {
        return _actives[beneficiary];
    }

    function _release(address addr, uint256 index) internal {
        Vesting storage vesting = _getVesting(addr, index);

        uint256 unreleased = _releasableAmount(vesting);
        require(unreleased > 0, "MultiVesting: no tokens are due");

        vesting.released += unreleased;

        crunch.transfer(vesting.beneficiary, unreleased);

        lockedReserve -= unreleased;

        emit TokensReleased(vesting.beneficiary, index, unreleased);

        if (vesting.released == vesting.amount) {
            _removeActive(addr, index);
        }
    }

    function _releaseAll(address addr) internal {
        uint256 totalReleased;

        uint256[] storage actives = _actives[addr];
        for (uint256 activeIndex = 0; activeIndex < actives.length; ) {
            uint256 index = actives[activeIndex];
            Vesting storage vesting = _getVesting(addr, index);

            uint256 unreleased = _releasableAmount(vesting);
            if (unreleased == 0) {
                activeIndex++;
                continue;
            }

            vesting.released += unreleased;
            lockedReserve -= unreleased;

            crunch.transfer(vesting.beneficiary, unreleased);

            emit TokensReleased(vesting.beneficiary, index, unreleased);

            if (vesting.released == vesting.amount) {
                _removeActiveAt(addr, activeIndex);
            } else {
                activeIndex++;
            }

            totalReleased += unreleased;
        }

        require(totalReleased > 0, "MultiVesting: no tokens are due");
    }

    function _removeActiveAt(address addr, uint256 activeIndex) internal {
        uint256[] storage actives = _actives[addr];

        actives[activeIndex] = actives[actives.length - 1];

        actives.pop();
    }

    function _removeActive(address addr, uint256 index) internal {
        uint256[] storage actives = _actives[addr];

        for (
            uint256 activeIndex = 0;
            activeIndex < actives.length;
            activeIndex++
        ) {
            if (actives[activeIndex] == index) {
                _removeActiveAt(addr, activeIndex);
                return;
            }
        }

        revert("MultiVesting: active index not found");
    }

    function _releasableAmount(Vesting memory vesting)
        internal
        view
        returns (uint256)
    {
        return _vestedAmount(vesting) - vesting.released;
    }

    function _vestedAmount(Vesting memory vesting)
        internal
        view
        returns (uint256)
    {
        uint256 amount = vesting.amount;

        if (block.timestamp < vesting.cliff) {
            return 0;
        } else if ((block.timestamp >= vesting.start + vesting.duration)) {
            return amount;
        } else {
            return
                (amount * (block.timestamp - vesting.start)) / vesting.duration;
        }
    }

    function _getVesting(address beneficiary, uint256 index)
        internal
        view
        returns (Vesting storage)
    {
        return vestings[beneficiary][index];
    }

    function _setCrunch(address newCrunch) internal {
        address previousCrunch = address(crunch);

        crunch = IERC20Metadata(newCrunch);

        emit CrunchTokenUpdated(previousCrunch, address(newCrunch));
    }

    function _setCreator(address newCreator) internal {
        address previous = creator;

        creator = newCreator;

        emit CreatorChanged(previous, newCreator);
    }

    modifier onlyCreatorOrOwner() {
        require(
            _msgSender() == creator || _msgSender() == owner(),
            "MultiVesting: only creator or owner can do this"
        );
        _;
    }
}
