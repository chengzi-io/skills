import { charge } from "./charge.ts";

if (charge(10, "USD").amount !== 10) {
  throw new Error("expected amount to pass through");
}
