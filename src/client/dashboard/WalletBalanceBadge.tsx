import { CoinBalanceBadge } from '../components/CoinBalanceBadge';

type WalletBalanceBadgeProps = {
  coins: number;
};

export const WalletBalanceBadge = ({ coins }: WalletBalanceBadgeProps) => (
  <CoinBalanceBadge
    coins={coins}
    variant="orange"
    className="px-4 py-1.5"
  />
);
