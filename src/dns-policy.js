import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

// Reject a hostname if any DNS answer is not globally routable.
// Wisp caches the selected answer and uses the same address for its socket.
export async function lookupPublicAddress(hostname) {
  const answers = await lookup(hostname, { all: true, verbatim: true });
  if (!answers.length) throw new Error("Hostname did not resolve.");

  for (const answer of answers) {
    const address = ipaddr.process(answer.address);
    if (address.range() !== "unicast") {
      throw new Error("Hostname resolves to a non-public network address.");
    }
  }

  return answers[0].address;
}

wisp.options.dns_method = lookupPublicAddress;
