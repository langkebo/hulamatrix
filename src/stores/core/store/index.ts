  const searchState = new SearchStateManager(
    () => authState.client.value,
    () => authState.users.value,
    () => roomState.rooms.value
  )
