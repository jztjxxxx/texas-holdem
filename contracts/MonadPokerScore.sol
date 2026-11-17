// SPDX-License-Identifier: MIT
// MonadPokerScore —— 德州扑克战绩上链（备用项目配套合约）
// 对局本身在前端跟机器人打；这个合约只负责把你的累计战绩存到 Monad 测试网上：
// 打了多少手、赢了多少手、打出过的最大牌型。公开可查，改不了。
pragma solidity ^0.8.20;

contract MonadPokerScore {
    struct Stats {
        uint256 games;       // 累计完成的手数
        uint256 wins;        // 累计赢下的手数
        uint8 bestHandRank;  // 打出过的最大牌型类别：0 高牌 … 5 同花 6 葫芦 7 四条 8 同花顺
        uint256 updatedAt;   // 上次更新时间
    }

    mapping(address => Stats) public statsOf;

    event MatchRecorded(address indexed player, uint256 games, uint256 wins, uint8 bestHandRank);

    // 把一批对局的汇总战绩记上链（前端打完几手后一键提交汇总，所以是累加）
    function recordMatch(uint256 games, uint256 wins, uint8 bestHandRank) external {
        require(games > 0, "games is 0");
        require(wins <= games, "wins > games");
        require(bestHandRank <= 8, "rank out of range");

        Stats storage s = statsOf[msg.sender];
        s.games += games;
        s.wins += wins;
        if (bestHandRank > s.bestHandRank) s.bestHandRank = bestHandRank;
        s.updatedAt = block.timestamp;

        emit MatchRecorded(msg.sender, games, wins, bestHandRank);
    }

    function getStats(address player) external view returns (uint256 games, uint256 wins, uint8 bestHandRank, uint256 updatedAt) {
        Stats memory s = statsOf[player];
        return (s.games, s.wins, s.bestHandRank, s.updatedAt);
    }
}
