import { CoinBalanceBadge } from '../components/CoinBalanceBadge';

type WalletBalanceBadgeProps = {
  coins: number;
};

export const WalletBalanceBadge = ({ coins }: WalletBalanceBadgeProps) => (
  <CoinBalanceBadge
    coins={coins}
    variant="gold"
    className="h-9 px-4"
  />
);
