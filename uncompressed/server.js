"use strict";

/**
 * User sessions
 * @param {Array} users
 */
const users = [];

/**
 * Find opponent for a user
 * @param {User} user
 */
function findOpponent(user) {
	for (let i = 0; i < users.length; i++) {
		if (user !== users[i] && users[i].opponent === null) {
			new Game(user, users[i]).match();
		}
	}
}

/**
 * Remove user session
 * @param {User} user
 */
function removeUser(user) {
	users.splice(users.indexOf(user), 1);
}

/**
 * Game class
 */
class Game {

	/**
	 * @param {User} user1 
	 * @param {User} user2 
	 */
	constructor(user1, user2) {
		this.user1 = user1;
		this.user2 = user2;
	}

	/**
	 * New game ready to be launched
	 */
	match() {
		this.user1.match(this, this.user2);
		this.user2.match(this, this.user1);
	}
    
    // Launch countdown
    count() {
		this.user1.count(this, this.user2);
		this.user2.count(this, this.user1);
    }
   
}

/**
 * User session class
 */
class User {

	/**
	 * @param {Socket} socket
	 */
	constructor(socket) {
		this.socket = socket;
		this.game = null;
		this.opponent = null;
	}

	/**
	 * Start new game
	 * @param {Game} game
	 * @param {User} opponent
	 */
	match(game, opponent) {
		this.game = game;
		this.opponent = opponent;
		this.socket.emit("match");
	}
    
	/**
	 * Terminate game
	 */
	end() {
		this.game = null;
		this.opponent = null;
		this.socket.emit("end");
	}

}

/**
 * Socket.IO on connect event
 * @param {Socket} socket
 */
module.exports = {

	io: (socket) => {
		const user = new User(socket);
		users.push(user);
        findOpponent(user);
        
        socket.on("mov", (ev, pos)=> {
            if (user.opponent) user.opponent.socket.emit("mov", ev, pos);
        });        
        socket.on("dmg", (q)=> {
            if (user.opponent) user.opponent.socket.emit("dmg", q);
        });        

		socket.on("disconnect", () => {
			removeUser(user);
			if (user.opponent) {
				user.opponent.end();
			}
		});
	}

};