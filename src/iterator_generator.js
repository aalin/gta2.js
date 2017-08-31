function increment(counts, maxes) {
  let add = true;
  let allMax = true;

  for (let i = counts.length - 1; i >= 0; i--) {
    allMax = true;

    if (add) {
      counts[i]++;
    }

    if (counts[i] > maxes[i]) {
      counts[i] = 0;
      add = true;
      allMax &= true;
      continue;
    }

    allMax = false;
    add = false;
  }

  if (allMax) {
    return false;
  }

  return true;
}

export default
function* iteratorGenerator(...maxes) {
  let counts = Array.from(maxes, () => 0);

  yield counts;

  while (true) {
    if (!increment(counts, maxes)) {
      return;
    }

    yield counts;
  }
}
