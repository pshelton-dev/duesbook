import type { WizardMember } from '../../../../shared/types'
import MemberCsvImport from '../../components/MemberCsvImport'

export default function StepMembers({
  members,
  onChange
}: {
  members: WizardMember[]
  onChange: (members: WizardMember[]) => void
}): React.JSX.Element {
  return (
    <>
      <h1>Members</h1>
      <p className="lead">
        Import your member list from a CSV file (every spreadsheet app can &ldquo;Save as
        CSV&rdquo;). The first row should be column names, like:{' '}
        <code>First Name, Last Name, Email, Phone, Join Date</code>. You can also skip this and
        add members later.
      </p>

      {members.length > 0 ? (
        <div className="panel notice">
          <strong>{members.length} members ready to import.</strong>{' '}
          <button className="btn small" onClick={() => onChange([])}>
            Start over
          </button>
        </div>
      ) : (
        <MemberCsvImport onImport={onChange} />
      )}
    </>
  )
}
