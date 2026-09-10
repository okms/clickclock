# UPD: Checking for updates

The product is otherwise fully offline (`NF-01`). This area is the single, deliberate
exception, and it is entirely user-initiated.

## Requirements

### UPD-01 Manual check only — Accepted
The user must be able to ask the product whether a newer version exists. The product must
never check on its own: not at launch, not on a schedule, not in the background.

### UPD-02 What is sent and to where — Accepted
A check must make exactly one request, to the project's public release page, carrying no
data about the user or their use of the product beyond what any web request carries. The
current version is compared locally.

### UPD-03 The answer is shown in place — Accepted
The product must show the outcome where the check was started: that the installed version
is the latest, that a specific newer version is available, or that the check could not be
completed (for example, offline). The current version is always visible next to the
control.

### UPD-04 Getting the update — Accepted
When a newer version exists, the product must offer to open the release page in the user's
browser. Downloading and installing happen there, exactly as for a first install.

### UPD-05 In-app download and install — Deferred
The product may later download and install the update itself. This needs update signing
and is out of scope for now.
