# Named regions, result collection, and lists

## Named completed regions

`=top:pay 1` <!-- expect:structure region-top -->
First:food = `=10`
Second:fuel = `=20`
`=sum:>pay 1` <!-- expect:error region-not-completed -->
`=bottom` <!-- expect:structure region-bottom -->

Named total = `=sum:>pay 1` <!-- expect:value 30 -->
Named filtered = `=sum:>pay 1{food}` <!-- expect:value 10 -->
`=sum:>missing` <!-- expect:error unknown-region -->
`=top:pay 1` <!-- expect:error duplicate-region-name -->

## Regional aggregate-result collection

DoorDash:door = `=12`
Nayax:nayax = `=8`
OpenAI:openai = `=10`

`=top`
DoorDash Total:approved = `=sum:door`
Nayax Total:approved = `=sum:nayax`
OpenAI Total = `=sum:openai`
Adjusted = `=sum:openai + 10`
Other Function = `=avg:openai`
Collected = `=sum:>[]` <!-- expect:value 30 -->
Collected again = `=sum:>[]` <!-- expect:value 30 -->
Approved collected = `=sum:>[]{approved}` <!-- expect:value 20 -->
`=bottom`

## Contributor lists

Alpha:items = `=1`
Beta:items = `=2 meters to cm`
Contributors = `=list:items` <!-- expect:value Alpha, Beta -->
Copied = `=Contributors` <!-- expect:value Alpha, Beta -->
`=sum:contributors` <!-- expect:error text-aggregate -->

`=top`
Regional one = `=1`
Regional two = `=2`
Regional contributors = `=list:>` <!-- expect:value Regional one, Regional two -->
`=bottom`
