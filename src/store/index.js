import { makeAutoObservable } from 'mobx';

class UserStore {
  userProfile = null;

  constructor() {
    makeAutoObservable(this);
  }

  setUser(userData) {
    this.userProfile = userData;
  }

  clearUser() {
    this.userProfile = null;
  }
}

export const userStore = new UserStore();