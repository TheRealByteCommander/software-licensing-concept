import unittest

from licensing_sdk.trpc import unwrap_error, unwrap_result, wrap_input


class TrpcHelpersTest(unittest.TestCase):
    def test_wrap_input(self):
        self.assertEqual(wrap_input({"token": "abc"}), {"json": {"token": "abc"}})

    def test_unwrap_result_superjson(self):
        payload = {"result": {"data": {"json": {"valid": True}}}}
        self.assertEqual(unwrap_result(payload), {"valid": True})

    def test_unwrap_result_plain(self):
        payload = {"result": {"data": {"valid": True}}}
        self.assertEqual(unwrap_result(payload), {"valid": True})

    def test_unwrap_error_superjson(self):
        payload = {
            "error": {
                "json": {
                    "message": "License not found",
                    "code": -32004,
                    "data": {"code": "NOT_FOUND"},
                }
            }
        }
        self.assertEqual(unwrap_error(payload), ("NOT_FOUND", "License not found"))


if __name__ == "__main__":
    unittest.main()
