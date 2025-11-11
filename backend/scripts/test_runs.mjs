import fetch from 'node-fetch';

const base = 'http://localhost:4000/api/challenges/run';

async function run(payload) {
  console.log('\n=== RUN:', payload.challengeId, payload.language, '===');
  const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const j = await r.json();
  console.log(JSON.stringify(j, null, 2));
}

(async () => {
  // Add Two Numbers tests (id 2)
  const jsAdd = {
    challengeId: '2',
    language: 'javascript',
    code: `function addTwoNumbers(l1, l2) { let carry = 0; let dummy = new ListNode(0); let cur = dummy; while (l1 || l2 || carry) { const v1 = l1 ? l1.val : 0; const v2 = l2 ? l2.val : 0; const sum = v1 + v2 + carry; carry = Math.floor(sum / 10); cur.next = new ListNode(sum % 10); cur = cur.next; if (l1) l1 = l1.next; if (l2) l2 = l2.next; } return dummy.next; }` };

  const pyAdd = {
    challengeId: '2',
    language: 'python',
    code: `class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef addTwoNumbers(l1, l2):\n    carry = 0\n    dummy = ListNode(0)\n    cur = dummy\n    while l1 or l2 or carry:\n        v1 = l1.val if l1 else 0\n        v2 = l2.val if l2 else 0\n        s = v1 + v2 + carry\n        carry = s // 10\n        cur.next = ListNode(s % 10)\n        cur = cur.next\n        if l1: l1 = l1.next\n        if l2: l2 = l2.next\n    return dummy.next\n` };

  // Reverse String (id 5)
  const pyRev = {
    challengeId: '5',
    language: 'python',
    code: `def solve(s):\n    return s[::-1]\n` };

  const javaRev = {
    challengeId: '5',
    language: 'java',
    code: `class Solution { public String solve(String s) { return new StringBuilder(s).reverse().toString(); } }` };

  try {
    await run(pyAdd);
    await run(jsAdd);
    await run(pyRev);
    await run(javaRev);
  } catch (e) {
    console.error('error running tests', e);
  }
})();
