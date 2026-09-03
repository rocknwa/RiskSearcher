import unittest
from core.rules import scan_bytecode

class TestOpcodeScanner(unittest.TestCase):
    def test_push20_no_selfdestruct(self):
        # Construct bytecode with many PUSH20 0xffff... immediate values
        push20 = '73' + 'ff'*20  # PUSH20 <20 bytes of 0xff>
        # repeat it several times to form a larger bytecode
        bc = '0x' + (push20 * 10)
        res = scan_bytecode(bc)
        self.assertEqual(len(res['found_opcodes']), 0, f"Unexpected opcodes: {res['found_opcodes']}")

    def test_real_selfdestruct_detected(self):
        # Simple bytecode where 0xff appears as an actual opcode after a JUMPDEST
        # 0x5b = JUMPDEST, 0xff = SELFDESTRUCT
        bc = '0x5bff'
        res = scan_bytecode(bc)
        ops = [o['opcode'] for o in res['found_opcodes']]
        self.assertIn('ff', ops, f"SELFDESTRUCT not detected in {res}")

if __name__ == '__main__':
    unittest.main()
