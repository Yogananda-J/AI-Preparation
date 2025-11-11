
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build(a):
    d = ListNode(0); c = d
    for x in a:
        c.next = ListNode(int(x)); c = c.next
    return d.next

def ser(h):
    out = []
    while h:
        out.append(h.val)
        h = h.next
    return '[' + ','.join(str(x) for x in out) + ']'

import sys, traceback
try:
    r = Solution().addTwoNumbers(build([2,4,3]), build([5,6,4]))
except Exception:
    try:
        r = addTwoNumbers(build([2,4,3]), build([5,6,4]))
    except Exception:
        r = None
print(ser(r))

