# Regional errors and reserved names

`=sum:>` <!-- expect:error unknown-region -->

## Reserved identifiers and memberships

top = `=10` <!-- expect:error reserved-identifier -->
CAC:top = `=10` <!-- expect:error reserved-identifier -->
`=sum:top` <!-- expect:error reserved-identifier -->
`=sum@top` <!-- expect:error reserved-identifier -->
Known:known = `=1`
`=sum:known{top}` <!-- expect:error reserved-identifier -->
`=top + 1` <!-- expect:error reserved-identifier -->
`=topp` <!-- expect:error unknown-variable -->

Top Amount = `=10`
bottom line = `=20`
Valid names = `=Top Amount + bottom line` <!-- expect:value 30 -->

## Balanced state and case-insensitive markers

`=Top` <!-- expect:structure region-top -->
Inside = `=2`
`=top` <!-- expect:error region-already-open -->
`=BOTTOM` <!-- expect:structure region-bottom -->
`=bottom` <!-- expect:error region-not-open -->
Case-insensitive result = `=sum:>` <!-- expect:value 2 -->

## Unclosed region warning

`=top` <!-- expect:warning unclosed-region -->
Open member = `=3`
