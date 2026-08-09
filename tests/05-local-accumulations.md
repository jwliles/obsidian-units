# UNITS-TEST 05 — Local accumulation lifecycle

This focused fixture documents read-and-close behavior independently of the
larger acceptance note.

## Reading closes after evaluation

A:g = `=1.00`
B:g = `=2.00`
First = `=sum@g` <!-- expect:value 3.00 -->

C:g = `=4.00`
Second = `=sum@g` <!-- expect:value 4.00 -->
Global = `=sum:g` <!-- expect:value 7.00 -->

## A bare declaration is not a general reset

D:h = `=10.00`
Memo = `=1.00`
E:h = `=5.00`
Local h = `=sum@h` <!-- expect:value 15.00 -->

## Closing one group leaves another open

X:left:right = `=20.00`
Y:left = `=5.00`
Close left = `=sum@left` <!-- expect:value 25.00 -->
Z:right = `=10.00`
Right remains continuous = `=sum@right` <!-- expect:value 30.00 -->

## Filters select but do not partially close

Card:pay:card = `=30.00`
Cash:pay:cash = `=20.00`
Card total = `=sum@pay{card}` <!-- expect:value 30.00 -->
Closed pay total = `=sum@pay` <!-- expect:value 50.00 -->

New:pay = `=7.00`
Fresh pay total = `=sum@pay` <!-- expect:value 7.00 -->

## Every local function closes after a successful read

Low:stats = `=2.00`
High:stats = `=8.00`

Median closes stats = `=median@stats` <!-- expect:value 5.00 -->
Repeated average = `=avg@stats` <!-- expect:value 5.00 -->
Repeated minimum = `=min@stats` <!-- expect:value 2.00 -->
Repeated maximum = `=max@stats` <!-- expect:value 8.00 -->
Repeated count = `=count@stats` <!-- expect:value 2 -->

Next:stats = `=4.00`
Fresh stats = `=sum@stats` <!-- expect:value 4.00 -->

## A failed local aggregate does not close

One:q = `=1.00`
Empty average = `=avg@q{missing}` <!-- expect:error empty-aggregate -->
Failed aggregate has no history = `=sum:empty average` <!-- expect:error unknown-group -->
Two:q = `=2.00`
Still active q = `=sum@q` <!-- expect:value 3.00 -->

## A successful empty local result does close

Present:emptyclose = `=6.00`
Empty sum closes = `=sum@emptyclose{missing}` <!-- expect:value 0 -->
Next:emptyclose = `=2.00`
Fresh after empty close = `=sum@emptyclose` <!-- expect:value 2.00 -->

## Active accumulation takes precedence over completed members

Old:priority:old = `=10.00`
Close old priority = `=sum@priority` <!-- expect:value 10.00 -->
New:priority:new = `=5.00`
No fallback through filter = `=sum@priority{old}` <!-- expect:value 0 -->

## Global reads never close local state

First:wide = `=10.00`
Global wide = `=sum:wide` <!-- expect:value 10.00 -->
Second:wide = `=5.00`
Local wide = `=sum@wide` <!-- expect:value 15.00 -->

## Duplicate explicit sigils do not duplicate records

Only:once:once = `=9.00`
Once total = `=sum:once` <!-- expect:value 9.00 -->
Once count = `=count:once` <!-- expect:value 1 -->
