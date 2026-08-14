# Named regions, result collection, and lists

## Named completed regions

`=top:pay 1` <!-- expect:structure region-top -->
First:food = `=10`
Second:fuel = `=20`
`=sum:>pay 1` <!-- expect:error region-not-completed -->
`=bottom` <!-- expect:structure region-bottom -->

Named total = `=sum:>pay 1` <!-- expect:value 30 -->
Named filtered = `=sum:>pay 1{food}` <!-- expect:value 10 -->
Named average = `=avg:>PAY 1` <!-- expect:value 15 -->
Named median = `=median:>pay 1` <!-- expect:value 15 -->
Named minimum = `=min:>pay 1` <!-- expect:value 10 -->
Named maximum = `=max:>pay 1` <!-- expect:value 20 -->
Named count = `=count:>pay 1` <!-- expect:value 2 -->
Named list = `=list:>pay 1` <!-- expect:value First, Second -->
`=sum:>missing` <!-- expect:error unknown-region -->
`=top:PAY 1` <!-- expect:error duplicate-region-name -->

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

## Empty and active result collection

`=top:raw only`
Raw = `=5`
Empty sum collection = `=sum:>[]` <!-- expect:value 0 -->
Empty count collection = `=count:>[]` <!-- expect:value 0 -->
`=avg:>[]` <!-- expect:error empty-aggregate -->
`=bottom`

## Every result-collection function

Numbers:a = `=1`
Numbers:a = `=2`
`=top:collectors`
Sum result = `=sum:a`
Average result = `=avg:a`
Median result = `=median:a`
Minimum result = `=min:a`
Maximum result = `=max:a`
Count result = `=count:a`
Collected sums = `=sum:>[]` <!-- expect:value 3 -->
Collected averages = `=avg:>[]` <!-- expect:value 1.5 -->
Collected medians = `=median:>[]` <!-- expect:value 1.5 -->
Collected minima = `=min:>[]` <!-- expect:value 1 -->
Collected maxima = `=max:>[]` <!-- expect:value 2 -->
Collected counts = `=count:>[]` <!-- expect:value 1 -->
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

## List scope, filters, and identity

Repeat:catalog:red = `=1`
Repeat:catalog:blue = `=2`
Other:catalog:blue = `=3`
Positive list = `=list:catalog{red}` <!-- expect:value Repeat -->
Negative list = `=list:catalog{!red}` <!-- expect:value Repeat, Other -->
Repeated identities = `=list:catalog` <!-- expect:value Repeat, Repeat, Other -->
Empty filtered list = `=list:catalog{missing}` <!-- expect:empty -->
Text value:mixed = `=list:catalog`
Quantity value:mixed = `=3 feet to cm`
Mixed-value list = `=list:mixed` <!-- expect:value Text value, Quantity value -->

Local one:session = `=1`
Local two:session = `=2`
Local list = `=list@session` <!-- expect:value Local one, Local two -->
Repeated closed list = `=list@session` <!-- expect:value Local one, Local two -->
Local three:session = `=3`
Next local list = `=list@session` <!-- expect:value Local three -->

`=list:>[]` <!-- expect:error aggregate-syntax -->
