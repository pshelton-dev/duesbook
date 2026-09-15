import { useLocalSearchParams } from 'expo-router'
import { MemberDetailView } from '../../../src/ui/screens/member-detail'

/** Phone: the member detail pushed over the roster. */
export default function MemberDetail(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <MemberDetailView memberId={Number(id)} />
}
