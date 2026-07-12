# Receiving dues through Venmo, PayPal, and friends

Members increasingly pay dues through a payment app, and your bank statement
then shows only a lump, anonymous deposit:

```
ACH CREDIT XXXXX6288 VENMO CASHOUT          $208.56
```

That one line might be four members' dues — the bank doesn't know, and neither
does Duesbook. **You** know, because the payment app's own activity list shows
who paid what and when. This guide shows two ways to get that knowledge into
the books. Both work with Duesbook as it is today.

## The simple way: allocate the lump

Best when the app is used for dues only, and you cash out reasonably often.

1. Record (or bank-import) the deposit into your checking account and set its
   category to **Dues**.
2. Duesbook flags it as an **unallocated dues deposit** — on Home and at the
   top of the Dues screen.
3. Click **Allocate**, open the payment app's activity list next to Duesbook,
   and add each member who's covered by that cashout. One deposit can be
   split across any number of members, and the amounts prefill with what each
   owes.

That's it — members get credited, the ledger matches the bank. The payment
date recorded is the deposit date, not the day each member tapped "Pay";
for monthly dues that's almost never a problem if you cash out monthly.

## The bookkeeper's way: treat the app as an account

Best when the app holds a balance for a while, receives non-dues money too
(fundraising, event fees), or charges fees.

1. In the wizard — or by asking a future version of Settings — add an account
   named **Venmo** (type: Other) alongside your bank accounts. Its opening
   balance is whatever the app held when your books started.
2. When a member pays, record it as **income in the Venmo account**: payee =
   the member, category = Dues, date = the day they actually paid. Allocate it
   to the member right there (it's a dues deposit like any other).
3. Non-dues money coming through the app is just income with a different
   category. Fees (PayPal goods-and-services, instant-transfer fees) are
   ordinary **expense** rows in the app account.
4. When you cash out, record a **transfer** from Venmo to Checking. When you
   later bank-import your checking statement, the import recognizes the
   cashout as your transfer (same amount, same dates) and offers to mark it
   cleared instead of adding a duplicate.

Every number then lands where an accountant would put it: dues are credited
to the right member on the right date, fees are visible as costs, and the
bank statement reconciles to the penny.

## Which one should you use?

Start with the simple way. Move to the account approach the first time you
catch yourself asking "wait, how much is still *in* Venmo?" — that question
is the sign the app has become a real account.

## About fees

If the app takes a cut (PayPal business payments do; Venmo friends-and-family
doesn't), decide once, as a matter of policy, what a member's $50 means:

- **Member owes the gross:** record $50 of dues income and a separate fee
  expense. The member is paid in full; the org absorbs the fee visibly.
- **Member owes the net:** record what actually arrived as their payment —
  they'll show a small balance owing. Choose this only if your org's rule is
  "dues must arrive in full."

Most small orgs choose the first: it keeps member records clean and shows the
true cost of accepting app payments in the year-end report.
