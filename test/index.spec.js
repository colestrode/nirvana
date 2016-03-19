var chai = require('chai');
var expect = chai.expect;
var sinon = require('sinon');
var path = require('path');
var helpers = require('./helpers');

chai.use(require('sinon-chai'));

describe('Nirvana', function() {
  var botMock;
  var controllerMock;
  var userMock;
  var nirvana;

  beforeEach(function() {
    userMock = {
      name: 'snowball',
      id: 'snuffles'
    };

    botMock = {
      reply: sinon.stub(),
      api: {
        users: {
          list: sinon.stub().yields(null, {ok: true, members: [userMock]})
        }
      }
    };

    controllerMock = {
      hears: sinon.stub(),
      log: sinon.stub(),
      storage: {
        users: {
          get: sinon.stub().yields(null, userMock),
          save: sinon.stub().yields(null)
        }
      }
    };

    delete require.cache[path.resolve('./index.js')];
    nirvana = require('../index.js');
  });

  describe('init', function() {

    beforeEach(function() {
      sinon.spy(console, 'log');
      return nirvana.init(controllerMock, botMock);
    });

    afterEach(function() {
      console.log.restore();
    });

    it('should register listeners', function() {
      expect(controllerMock.hears).to.have.been.calledTwice;
    });

    it('should populate the user cache', function() {
      expect(botMock.api.users.list).to.have.been.called;
      expect(console.log).not.to.have.been.called;
    });

    it('should handle an error listing users', function() {
      var error = new Error('WHOOPS');

      botMock.api.users.list.reset();
      botMock.api.users.list.yields(error);

      return nirvana.init(controllerMock, botMock)
        .then(function() {
          expect(botMock.api.users.list).to.have.been.called;
          expect(console.log).to.have.been.calledWithMatch(/^Error updating/, error);
        });
    });

    it('should handle if user list request is not ok', function() {
      botMock.api.users.list.reset();
      botMock.api.users.list.yields(null, {ok: false, error: 'WHOOPS'});

      return nirvana.init(controllerMock, botMock)
        .then(function() {
          expect(botMock.api.users.list).to.have.been.called;
          expect(console.log).to.have.been.calledWithMatch(/^Error updating/);
        });
    });
  });

  describe('Listeners', function() {
    var messageMock;
    var error;

    beforeEach(function() {
      messageMock = {
        user: 'morty',
        match: [null, 'snowball']
      };

      error = new Error('LITTLE MORTY');
    });

    describe('Shared paths', function() {

      ['morty++', 'karma morty'].forEach(function(command) {
        describe(command, function() {
          var callback;

          beforeEach(function() {

            sinon.spy(console, 'log');

            return nirvana.init(controllerMock, botMock)
              .then(function() {
                botMock.api.users.list.reset();
                callback = helpers.getHearsCallbackForMessage(controllerMock, command);
              });
          });

          afterEach(function() {
            console.log.restore();
          });

          it('should get a recognized user', function() {
            messageMock.match[1] = '<@URICK123>';

            return callback(botMock, messageMock)
              .then(function() {
                expect(botMock.api.users.list).not.to.have.been.called;
              });
          });

          it('should get a user from the cache', function() {
            messageMock.match[1] = userMock.name;

            return callback(botMock, messageMock)
              .then(function() {
                expect(botMock.api.users.list).not.to.have.been.called;
              });
          });

          it('should populate cache and get user from cache', function() {
            messageMock.match[1] = 'morty';
            botMock.api.users.list.yields(null, {ok: true, members: [{id: 'morty', name: 'morty'}]});

            return callback(botMock, messageMock)
              .then(function() {
                expect(botMock.api.users.list).to.have.been.called;
              });
          });

          it('should populate cache and throw error if user not found', function() {
            messageMock.match[1] = 'morty';

            return helpers.promiseFail(callback(botMock, messageMock))
              .fail(function() {
                expect(botMock.api.users.list).to.have.been.called;
              });
          });

          it('should log an error if populating cache fails', function() {
            messageMock.match[1] = 'morty';

            botMock.api.users.list.yields(error);

            return callback(botMock, messageMock)
              .then(function() {
                expect(botMock.api.users.list).to.have.been.called;
                expect(console.log).to.have.been.calledWith('Error updating nirvana user cache', error);
              });
          });
        });
      });
    });

    describe('Awarding Karma', function() {
      var callback;

      beforeEach(function() {
        return nirvana.init(controllerMock, botMock)
          .then(function() {
            callback = helpers.getHearsCallbackForMessage(controllerMock, 'morty++');
          });
      });

      it('should award karma to a new user', function() {
        controllerMock.storage.users.get.yields(null, null);

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).to.have.been.calledWith({id: 'snuffles', karma: 1});
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /has 1 karma/);
          });
      });

      it('should award karma to a user with no karma', function() {
        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).to.have.been.calledWith(userMock);
            expect(userMock.karma).to.equal(1);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /has 1 karma/);
          });
      });

      it('should award karma to a user with karma', function() {
        userMock.karma = 1;

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).to.have.been.calledWith(userMock);
            expect(userMock.karma).to.equal(2);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /has 2 karma/);
          });
      });

      it('should throw a party when the user has a multiple of 100 karma', function() {
        userMock.karma = 199;

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).to.have.been.calledWith(userMock);
            expect(userMock.karma).to.equal(200);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /:100::100:/);
          });
      });

      it('should warn the user if they try to award themselves', function() {
        userMock.id = 'morty';
        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).not.to.have.been.calledWith(userMock);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /tsk tsk tsk/);
          });
      });

      it('should handle an error if getting a user fails', function() {
        controllerMock.storage.users.get.yields(error);

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).not.to.have.been.calledWith(userMock);
            expect(controllerMock.log).to.have.been.calledWith(error);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /Sorry/);
          });
      });

      it('should handle an error if updating cache fails', function() {
        messageMock.match[1] = 'rick';
        botMock.api.users.list.yields(error);

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).not.to.have.been.calledWith(userMock);
            expect(controllerMock.log).to.have.been.calledWith(error);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /Sorry/);
          });
      });

      it('should handle an error if saving fails', function() {
        controllerMock.storage.users.save.yields(error);

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.storage.users.save).to.have.been.calledWith(userMock);
            expect(controllerMock.log).to.have.been.calledWith(error);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /Sorry/);
          });
      });
    });

    describe('Listing karma', function() {
      var callback;

      beforeEach(function() {
        return nirvana.init(controllerMock, botMock)
          .then(function() {
            callback = helpers.getHearsCallbackForMessage(controllerMock, 'karma morty');
          });
      });

      it('should list karma for a new user', function() {
        controllerMock.storage.users.get.yields(null, null);

        return callback(botMock, messageMock)
          .then(function() {
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /has 0 karma/);
          });
      });

      it('should list karma for a user with no karma', function() {
        return callback(botMock, messageMock)
          .then(function() {
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /has 0 karma/);
          });
      });

      it('should list karma to a user with karma', function() {
        userMock.karma = 1;

        return callback(botMock, messageMock)
          .then(function() {
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /has 1 karma/);
          });
      });

      it('should handle an error if getting a user fails', function() {
        controllerMock.storage.users.get.yields(error);

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.log).to.have.been.calledWith(error);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /Sorry/);
          });
      });

      it('should handle an error if updating cache fails', function() {
        messageMock.match[1] = 'rick';
        botMock.api.users.list.yields(error);

        return callback(botMock, messageMock)
          .then(function() {
            expect(controllerMock.log).to.have.been.calledWith(error);
            expect(botMock.reply).to.have.been.calledWithMatch(messageMock, /Sorry/);
          });
      });
    });
  });
});
